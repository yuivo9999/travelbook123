import { Notebook, ContentItem, MediaRecord } from '../types';
import { getAllNotebooks, getAllItems, getMedia, saveNotebook, saveItem, saveMedia } from '../db/indexedDB';
import { getOriginalMediaBlob, processImageFile, processVideoFile } from './media';

const BACKUP_APP_NAME = 'Travelbook Digital Scrapbook' as const;
const BACKUP_VERSION = '5.1.0' as const;
const MIN_SUPPORTED_BACKUP_MAJOR = 4;
const BACKUP_EXTENSION = '.zip';
const DATA_FILE = 'data.json';
const MANIFEST_FILE = 'manifest.json';
const ZIP64_EXTRA = 0x0001;
const ZIP64_LIMIT = 0xffffffff;
const CRC_CHUNK_SIZE = 4 * 1024 * 1024;

export interface ExportedMedia { id: string; notebookId: string; type: 'image' | 'video'; mimeType: string; width?: number; height?: number; duration?: number; fileName?: string; fileSize?: number; sourceUrl?: string; archivePath: string; }
export interface ScrapbookBackup { appName: typeof BACKUP_APP_NAME; version: string; exportType: 'full'; scope: 'single' | 'all'; exportedAt: string; notebooks: Notebook[]; items: ContentItem[]; media: ExportedMedia[]; mediaBlobs: Map<string, Blob>; compression?: { policy: 'store'; archiveSize: number; uncompressedSize: number; ratio: number }; }
export type ExportScope = 'all' | string;
export type ExportMode = 'full';
type ZipData = Blob | Uint8Array;
type ZipEntry = { name: string; data: ZipData; size: number; crc: number };
type ZipReadEntry = { blob: Blob; crc: number; size: number; compressed: boolean };

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function crc32(data: Uint8Array, initial = 0xffffffff): number {
  let crc = initial;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return crc >>> 0;
}

async function crc32Blob(blob: Blob): Promise<number> {
  let crc = 0xffffffff;
  for (let offset = 0; offset < blob.size; offset += CRC_CHUNK_SIZE) {
    const bytes = new Uint8Array(await blob.slice(offset, Math.min(offset + CRC_CHUNK_SIZE, blob.size)).arrayBuffer());
    crc = crc32(bytes, crc);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function safeArchiveName(name: string | undefined, fallback: string): string {
  const cleaned = (name || fallback).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim();
  return cleaned || fallback;
}

function writeU16(view: DataView, offset: number, value: number) { view.setUint16(offset, value, true); }
function writeU32(view: DataView, offset: number, value: number) { view.setUint32(offset, value >>> 0, true); }
function writeU64(view: DataView, offset: number, value: number) { view.setBigUint64(offset, BigInt(Math.trunc(value)), true); }
function readU64(view: DataView, offset: number): number { const value = view.getBigUint64(offset, true); if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('ZIP 文件过大，当前浏览器无法安全处理该文件。'); return Number(value); }

function makeZip64Extra(values: number[]): Uint8Array {
  const extra = new Uint8Array(4 + values.length * 8);
  const view = new DataView(extra.buffer);
  writeU16(view, 0, ZIP64_EXTRA);
  writeU16(view, 2, values.length * 8);
  values.forEach((value, index) => writeU64(view, 4 + index * 8, value));
  return extra;
}

async function prepareZipEntry(name: string, data: ZipData): Promise<ZipEntry> {
  const size = data instanceof Blob ? data.size : data.byteLength;
  const crc = data instanceof Blob ? await crc32Blob(data) : crc32(data) ^ 0xffffffff;
  return { name, data, size, crc: crc >>> 0 };
}

/**
 * ZIP64/store writer. Media stays as Blob parts, so the whole scrapbook is never
 * converted into one giant ArrayBuffer. CRC is calculated in 4 MiB chunks.
 */
async function createZip(entries: Array<{ name: string; data: ZipData }>): Promise<{ blob: Blob; uncompressedSize: number }> {
  const prepared: ZipEntry[] = [];
  let uncompressedSize = 0;
  for (const entry of entries) {
    const preparedEntry = await prepareZipEntry(entry.name, entry.data);
    prepared.push(preparedEntry);
    uncompressedSize += preparedEntry.size;
  }

  const localParts: BlobPart[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of prepared) {
    const name = textEncoder.encode(entry.name);
    const localExtra = makeZip64Extra([entry.size, entry.size]);
    const local = new Uint8Array(30 + name.length + localExtra.length);
    const lv = new DataView(local.buffer);
    writeU32(lv, 0, 0x04034b50);
    writeU16(lv, 4, 45);
    writeU16(lv, 6, 0x0800);
    writeU16(lv, 8, 0);
    writeU16(lv, 10, 0);
    writeU16(lv, 12, 0);
    writeU32(lv, 14, entry.crc);
    writeU32(lv, 18, ZIP64_LIMIT);
    writeU32(lv, 22, ZIP64_LIMIT);
    writeU16(lv, 26, name.length);
    writeU16(lv, 28, localExtra.length);
    local.set(name, 30);
    local.set(localExtra, 30 + name.length);
    localParts.push(local, entry.data instanceof Blob ? entry.data : new Blob([entry.data]));

    const centralExtra = makeZip64Extra([entry.size, entry.size, offset]);
    const central = new Uint8Array(46 + name.length + centralExtra.length);
    const cv = new DataView(central.buffer);
    writeU32(cv, 0, 0x02014b50);
    writeU16(cv, 4, 45);
    writeU16(cv, 6, 45);
    writeU16(cv, 8, 0x0800);
    writeU16(cv, 10, 0);
    writeU16(cv, 12, 0);
    writeU16(cv, 14, 0);
    writeU32(cv, 16, entry.crc);
    writeU32(cv, 20, ZIP64_LIMIT);
    writeU32(cv, 24, ZIP64_LIMIT);
    writeU16(cv, 28, name.length);
    writeU16(cv, 30, centralExtra.length);
    writeU16(cv, 32, 0);
    writeU16(cv, 34, 0);
    writeU16(cv, 36, 0);
    writeU32(cv, 38, 0);
    writeU32(cv, 42, ZIP64_LIMIT);
    central.set(name, 46);
    central.set(centralExtra, 46 + name.length);
    centralParts.push(central);
    offset += local.length + entry.size;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const zip64EocdOffset = offset + centralSize;
  const zip64Eocd = new Uint8Array(56);
  const zv = new DataView(zip64Eocd.buffer);
  writeU32(zv, 0, 0x06064b50);
  writeU64(zv, 4, 44);
  writeU16(zv, 12, 45);
  writeU16(zv, 14, 45);
  writeU32(zv, 16, 0);
  writeU32(zv, 20, 0);
  writeU64(zv, 24, prepared.length);
  writeU64(zv, 32, prepared.length);
  writeU64(zv, 40, centralSize);
  writeU64(zv, 48, offset);

  const locator = new Uint8Array(20);
  const lov = new DataView(locator.buffer);
  writeU32(lov, 0, 0x07064b50);
  writeU32(lov, 4, 0);
  writeU64(lov, 8, zip64EocdOffset);
  writeU32(lov, 16, 1);

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  writeU32(ev, 0, 0x06054b50);
  writeU16(ev, 4, 0xffff);
  writeU16(ev, 6, 0xffff);
  writeU16(ev, 8, 0xffff);
  writeU16(ev, 10, 0xffff);
  writeU32(ev, 12, ZIP64_LIMIT);
  writeU32(ev, 16, ZIP64_LIMIT);
  writeU16(ev, 20, 0);

  return {
    blob: new Blob([...localParts, ...centralParts, zip64Eocd, locator, eocd], { type: 'application/zip' }),
    uncompressedSize,
  };
}

async function readZipEntries(file: File): Promise<Map<string, ZipReadEntry>> {
  const tailSize = Math.min(file.size, 0xffff + 22 + 20 + 56);
  const tailStart = Math.max(0, file.size - tailSize);
  const tailBytes = new Uint8Array(await file.slice(tailStart).arrayBuffer());
  let eocdRelative = -1;
  for (let i = tailBytes.length - 22; i >= 0; i--) {
    if (tailBytes[i] === 0x50 && tailBytes[i + 1] === 0x4b && tailBytes[i + 2] === 0x05 && tailBytes[i + 3] === 0x06) { eocdRelative = i; break; }
  }
  if (eocdRelative < 0) throw new Error('无效的 ZIP 备份文件：未找到 ZIP 目录。');
  const eocd = new DataView(tailBytes.buffer, tailBytes.byteOffset, tailBytes.byteLength);
  let entryCount = eocd.getUint16(eocdRelative + 10, true);
  let centralSize = eocd.getUint32(eocdRelative + 12, true);
  let centralOffset = eocd.getUint32(eocdRelative + 16, true);

  if (entryCount === 0xffff || centralSize === ZIP64_LIMIT || centralOffset === ZIP64_LIMIT) {
    const locatorRelative = eocdRelative - 20;
    if (locatorRelative < 0 || eocd.getUint32(locatorRelative, true) !== 0x07064b50) throw new Error('ZIP64 备份缺少 ZIP64 目录定位信息。');
    const zip64Offset = readU64(eocd, locatorRelative + 8);
    if (zip64Offset + 56 > file.size) throw new Error('ZIP64 目录位置异常。');
    const zip64Bytes = new Uint8Array(await file.slice(zip64Offset, zip64Offset + 56).arrayBuffer());
    const zv = new DataView(zip64Bytes.buffer, zip64Bytes.byteOffset, zip64Bytes.byteLength);
    if (zv.getUint32(0, true) !== 0x06064b50) throw new Error('ZIP64 目录格式错误。');
    entryCount = readU64(zv, 32);
    centralSize = readU64(zv, 40);
    centralOffset = readU64(zv, 48);
  }

  if (centralOffset + centralSize > file.size) throw new Error('ZIP 备份文件目录损坏。');
  const centralBytes = new Uint8Array(await file.slice(centralOffset, centralOffset + centralSize).arrayBuffer());
  const result = new Map<string, ZipReadEntry>();
  let cursor = 0;

  for (let i = 0; i < entryCount; i++) {
    if (cursor + 46 > centralBytes.length) throw new Error('ZIP 备份文件目录不完整。');
    const view = new DataView(centralBytes.buffer, centralBytes.byteOffset, centralBytes.byteLength);
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('ZIP 备份文件目录格式错误。');
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    let compressedSize = view.getUint32(cursor + 20, true);
    let uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    let localOffset = view.getUint32(cursor + 42, true);
    const crc = view.getUint32(cursor + 16, true);
    const name = textDecoder.decode(centralBytes.slice(cursor + 46, cursor + 46 + nameLength));
    const extraStart = cursor + 46 + nameLength;
    const extraEnd = extraStart + extraLength;

    if (flags & 0x0001) throw new Error(`备份文件包含加密条目，无法导入：${name}`);
    if (method !== 0) throw new Error(`当前备份仅支持未压缩条目：${name}`);

    if (compressedSize === ZIP64_LIMIT || uncompressedSize === ZIP64_LIMIT || localOffset === ZIP64_LIMIT) {
      let p = extraStart;
      let found = false;
      while (p + 4 <= extraEnd) {
        const id = view.getUint16(p, true);
        const size = view.getUint16(p + 2, true);
        const end = p + 4 + size;
        if (end > extraEnd) throw new Error(`ZIP64 扩展字段损坏：${name}`);
        if (id === ZIP64_EXTRA) {
          let q = p + 4;
          if (uncompressedSize === ZIP64_LIMIT) { uncompressedSize = readU64(view, q); q += 8; }
          if (compressedSize === ZIP64_LIMIT) { compressedSize = readU64(view, q); q += 8; }
          if (localOffset === ZIP64_LIMIT) { localOffset = readU64(view, q); q += 8; }
          found = true;
          break;
        }
        p = end;
      }
      if (!found) throw new Error(`ZIP 条目缺少 ZIP64 扩展字段：${name}`);
    }

    if (localOffset + 30 > file.size) throw new Error(`ZIP 条目损坏：${name}`);
    const localHeader = new Uint8Array(await file.slice(localOffset, localOffset + 30).arrayBuffer());
    const localView = new DataView(localHeader.buffer, localHeader.byteOffset, localHeader.byteLength);
    if (localView.getUint32(0, true) !== 0x04034b50) throw new Error(`ZIP 条目头损坏：${name}`);
    const localNameLength = localView.getUint16(26, true);
    const localExtraLength = localView.getUint16(28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > file.size) throw new Error(`ZIP 条目大小异常：${name}`);
    result.set(name, { blob: file.slice(dataStart, dataEnd), crc, size: uncompressedSize, compressed: false });
    cursor = 46 + nameLength + extraLength + commentLength + cursor;
  }
  return result;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function generateId(prefix: string): string {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${uuid}`;
}

function buildDataJson(backup: Omit<ScrapbookBackup, 'mediaBlobs'>): Uint8Array {
  return textEncoder.encode(JSON.stringify({ appName: backup.appName, version: backup.version, exportType: backup.exportType, scope: backup.scope, exportedAt: backup.exportedAt, notebooks: backup.notebooks, items: backup.items, media: backup.media }));
}

function buildManifest(backup: Omit<ScrapbookBackup, 'mediaBlobs'>): Uint8Array {
  return textEncoder.encode(JSON.stringify({ format: 'digital-scrapbook-zip', formatVersion: backup.version, appName: backup.appName, exportType: backup.exportType, scope: backup.scope, exportedAt: backup.exportedAt, notebookCount: backup.notebooks.length, itemCount: backup.items.length, mediaCount: backup.media.length, dataFile: DATA_FILE }, null, 2));
}

export async function exportScrapbookData(options: { targetNotebookId?: string | 'all'; mode?: ExportMode; onProgress?: (percent: number, status: string) => void }): Promise<void> {
  const { targetNotebookId = 'all', onProgress } = options;
  onProgress?.(5, '正在读取手账数据...');
  const allNotebooks = await getAllNotebooks();
  const targetNotebooks = targetNotebookId === 'all' ? allNotebooks : allNotebooks.filter((nb) => nb.id === targetNotebookId);
  if (!targetNotebooks.length) throw new Error('未找到要导出的手账本');
  const targetNotebookIds = new Set(targetNotebooks.map((nb) => nb.id));
  const targetItems = (await getAllItems()).filter((item) => targetNotebookIds.has(item.notebookId));
  const mediaIds = Array.from(new Set([
    ...targetItems.map((item) => item.mediaId).filter((id): id is string => Boolean(id?.trim())),
    ...targetNotebooks.map((nb) => nb.coverImageId).filter((id): id is string => Boolean(id?.trim())),
  ]));
  const mediaEntries: ExportedMedia[] = [];
  const zipEntries: Array<{ name: string; data: ZipData }> = [];
  const mediaById = new Map<string, ExportedMedia>();

  onProgress?.(20, '正在读取高清照片与原始视频...');
  for (let i = 0; i < mediaIds.length; i++) {
    const mediaId = mediaIds[i];
    onProgress?.(20 + Math.round(((i + 1) / Math.max(1, mediaIds.length)) * 65), `正在准备媒体 (${i + 1}/${mediaIds.length})...`);
    const media = await getMedia(mediaId);
    if (!media) throw new Error(`找不到媒体文件：${mediaId}`);
    const rawBlob = await getOriginalMediaBlob(media);
    if (!rawBlob || rawBlob.size === 0) throw new Error(`媒体“${media.fileName || mediaId}”缺少完整原始文件，已停止导出。`);
    const fileName = safeArchiveName(media.fileName, media.type === 'video' ? `video_${mediaId}.mp4` : `image_${mediaId}.jpg`);
    const archivePath = `media/${String(i + 1).padStart(4, '0')}_${fileName}`;
    const mediaMeta: ExportedMedia = { id: media.id, notebookId: media.notebookId, type: media.type, mimeType: media.mimeType, width: media.width, height: media.height, duration: media.duration, fileName: media.fileName, fileSize: media.fileSize ?? rawBlob.size, sourceUrl: undefined, archivePath };
    mediaEntries.push(mediaMeta);
    mediaById.set(media.id, mediaMeta);
    // Keep the original Blob. Do not call arrayBuffer() here.
    zipEntries.push({ name: archivePath, data: rawBlob });
  }

  const backupWithoutBlobs = {
    appName: BACKUP_APP_NAME,
    version: BACKUP_VERSION,
    exportType: 'full' as const,
    scope: targetNotebookId === 'all' ? 'all' as const : 'single' as const,
    exportedAt: new Date().toISOString(),
    notebooks: targetNotebooks,
    items: targetItems.map((item) => {
      const related = item.mediaId ? mediaById.get(item.mediaId) : undefined;
      return { ...item, originalFileName: related?.fileName || (item as any).originalFileName, sourceUrl: related?.sourceUrl || (item as any).sourceUrl };
    }),
    media: mediaEntries,
  };

  zipEntries.unshift({ name: MANIFEST_FILE, data: buildManifest(backupWithoutBlobs) }, { name: DATA_FILE, data: buildDataJson(backupWithoutBlobs) });
  onProgress?.(90, '正在生成大文件 ZIP64 备份包...');
  const zipResult = await createZip(zipEntries);
  const compressionRatio = zipResult.uncompressedSize > 0 ? zipResult.blob.size / zipResult.uncompressedSize : 1;
  const dateStr = new Date().toISOString().slice(0, 10);
  const nbName = targetNotebookId === 'all' ? '全部手账' : safeArchiveName(targetNotebooks[0]?.title, '单本手账');
  downloadBlob(zipResult.blob, `手账全量备份_${nbName}_${dateStr}${BACKUP_EXTENSION}`);
  onProgress?.(100, `ZIP64 全量备份导出完成（未压缩，归档体积约为原始数据的 ${(compressionRatio * 100).toFixed(1)}%）！`);
}

export async function parseBackupFile(file: File): Promise<ScrapbookBackup> {
  if (!file.name.toLowerCase().endsWith('.zip') && file.type !== 'application/zip') throw new Error('只支持 ZIP 全量备份文件（.zip）。');
  let entries: Map<string, ZipReadEntry>;
  try { entries = await readZipEntries(file); } catch (error) { throw new Error(error instanceof Error ? error.message : 'ZIP 文件结构读取失败。'); }
  const dataEntry = entries.get(DATA_FILE);
  if (!dataEntry) throw new Error('无效的手账 ZIP 备份：缺少 data.json。');
  let data: any;
  try {
    const rawBytes = new Uint8Array(await dataEntry.blob.arrayBuffer());
    if (crc32(rawBytes) !== dataEntry.crc) throw new Error('数据校验失败');
    data = JSON.parse(textDecoder.decode(rawBytes));
  } catch (error) { throw new Error(`手账 ZIP 数据读取失败：${error instanceof Error ? error.message : 'data.json 无法解析'}。`); }
  if (!data || !Array.isArray(data.notebooks) || !Array.isArray(data.items) || !Array.isArray(data.media)) throw new Error('无效的手账 ZIP 备份：缺少手账本、内容或媒体数据。');
  if (data.exportType !== 'full') throw new Error('该备份不是全量备份，无法导入。');
  const versionText = String(data.version || BACKUP_VERSION);
  const major = Number.parseInt(versionText.split('.')[0] || '0', 10);
  if (!Number.isFinite(major) || major < MIN_SUPPORTED_BACKUP_MAJOR) throw new Error(`备份版本 ${versionText} 过旧，当前至少支持 V4 ZIP 备份。`);

  const manifestEntry = entries.get(MANIFEST_FILE);
  if (manifestEntry) {
    try {
      const rawManifest = new Uint8Array(await manifestEntry.blob.arrayBuffer());
      if (crc32(rawManifest) !== manifestEntry.crc) throw new Error('manifest 校验失败');
      const manifest = JSON.parse(textDecoder.decode(rawManifest));
      if (manifest.format && manifest.format !== 'digital-scrapbook-zip') throw new Error('ZIP 格式标识不匹配');
      if (manifest.dataFile !== undefined && manifest.dataFile !== DATA_FILE) throw new Error('ZIP 数据文件声明不匹配');
    } catch (error) { throw new Error(`手账 ZIP 清单读取失败：${error instanceof Error ? error.message : 'manifest.json 无法解析'}。`); }
  }

  const mediaBlobs = new Map<string, Blob>();
  const media: ExportedMedia[] = [];
  let uncompressedSize = dataEntry.size;
  for (const meta of data.media as ExportedMedia[]) {
    if (!meta?.id || !meta.archivePath) throw new Error('备份包含无效的媒体索引。');
    const entry = entries.get(meta.archivePath);
    if (!entry) throw new Error(`备份缺少媒体文件：${meta.fileName || meta.id}`);
    uncompressedSize += entry.size;
    const mediaBlob = entry.blob.slice(0, entry.blob.size, meta.mimeType || 'application/octet-stream');
    if (mediaBlob.size !== entry.size) throw new Error(`媒体文件大小校验失败：${meta.fileName || meta.id}`);
    mediaBlobs.set(meta.id, mediaBlob);
    media.push(meta);
  }

  const referencedMediaIds = new Set<string>();
  for (const item of data.items as ContentItem[]) if (item.mediaId) referencedMediaIds.add(item.mediaId);
  for (const notebook of data.notebooks as Notebook[]) if (notebook.coverImageId) referencedMediaIds.add(notebook.coverImageId);
  for (const id of referencedMediaIds) if (!mediaBlobs.has(id)) throw new Error(`备份索引引用了缺失的媒体：${id}`);

  return {
    appName: data.appName || BACKUP_APP_NAME,
    version: versionText,
    exportType: 'full',
    scope: data.scope === 'single' ? 'single' : 'all',
    exportedAt: data.exportedAt || new Date().toISOString(),
    notebooks: data.notebooks,
    items: data.items,
    media,
    mediaBlobs,
    compression: { policy: 'store', archiveSize: file.size, uncompressedSize, ratio: uncompressedSize > 0 ? file.size / uncompressedSize : 1 },
  };
}

export async function executeImport(options: { backup: ScrapbookBackup; selectedNotebookIds: string[]; importMode?: 'full'; nameHandling: 'copy' | 'overwrite'; onProgress?: (percent: number, status: string) => void }): Promise<{ importedNotebooks: number; importedItems: number }> {
  const { backup, selectedNotebookIds, nameHandling, onProgress } = options;
  if (backup.exportType !== 'full') throw new Error('只允许导入全量 ZIP 备份。');
  const targetNotebooks = backup.notebooks.filter((nb) => selectedNotebookIds.includes(nb.id));
  if (!targetNotebooks.length) throw new Error('未选择任何要导入的手账本');
  const existingNotebooks = await getAllNotebooks();
  const notebookIdMap = new Map<string, string>();
  const itemIdMap = new Map<string, string>();
  const mediaIdMap = new Map<string, string>();
  onProgress?.(10, '正在建立完整 ID 映射...');
  for (const nb of targetNotebooks) notebookIdMap.set(nb.id, nameHandling === 'copy' ? generateId('nb') : nb.id);
  const targetItems = backup.items.filter((item) => selectedNotebookIds.includes(item.notebookId));
  const targetMediaIds = new Set([
    ...targetItems.map((item) => item.mediaId).filter((id): id is string => Boolean(id)),
    ...targetNotebooks.map((nb) => nb.coverImageId).filter((id): id is string => Boolean(id)),
  ]);
  const targetMedia = backup.media.filter((media) => targetMediaIds.has(media.id));
  for (const item of targetItems) itemIdMap.set(item.id, nameHandling === 'copy' ? generateId('item') : item.id);
  for (const media of targetMedia) mediaIdMap.set(media.id, nameHandling === 'copy' ? generateId('media') : media.id);

  for (const nb of targetNotebooks) {
    const finalId = notebookIdMap.get(nb.id) || nb.id;
    const finalTitle = nameHandling === 'copy' ? `${nb.title} (导入副本)` : nb.title;
    await saveNotebook({ ...nb, id: finalId, title: finalTitle, coverImageId: nb.coverImageId ? (mediaIdMap.get(nb.coverImageId) || nb.coverImageId) : nb.coverImageId, updatedAt: Date.now() });
  }

  onProgress?.(25, '正在恢复高清照片与原始视频...');
  for (let i = 0; i < targetMedia.length; i++) {
    const expMedia = targetMedia[i];
    const blob = backup.mediaBlobs.get(expMedia.id);
    if (!blob || blob.size === 0) throw new Error(`备份中的媒体文件不可用：${expMedia.fileName || expMedia.id}`);
    const newNotebookId = notebookIdMap.get(expMedia.notebookId) || expMedia.notebookId;
    let thumbnailBlob: Blob | undefined;
    try {
      if (expMedia.type === 'image') {
        const preview = await processImageFile(blob);
        thumbnailBlob = preview.thumbnailBlob;
      } else {
        const preview = await processVideoFile(blob);
        thumbnailBlob = preview.thumbnailBlob || undefined;
      }
    } catch { thumbnailBlob = undefined; }
    await saveMedia({ id: mediaIdMap.get(expMedia.id) || expMedia.id, notebookId: newNotebookId, type: expMedia.type, mimeType: expMedia.mimeType, blob, thumbnailBlob, storageKey: undefined, width: expMedia.width, height: expMedia.height, duration: expMedia.duration, fileName: expMedia.fileName, fileSize: expMedia.fileSize ?? blob.size, createdAt: Date.now() });
    onProgress?.(25 + Math.round(((i + 1) / Math.max(1, targetMedia.length)) * 45), `正在恢复媒体 (${i + 1}/${targetMedia.length})...`);
  }

  onProgress?.(72, '正在恢复手账排版与内容...');
  for (let i = 0; i < targetItems.length; i++) {
    const item = targetItems[i];
    const newNotebookId = notebookIdMap.get(item.notebookId) || item.notebookId;
    const newMediaId = item.mediaId ? (mediaIdMap.get(item.mediaId) || item.mediaId) : item.mediaId;
    await saveItem({ ...item, id: itemIdMap.get(item.id) || item.id, notebookId: newNotebookId, mediaId: newMediaId, updatedAt: Date.now() });
    onProgress?.(72 + Math.round(((i + 1) / Math.max(1, targetItems.length)) * 28), `正在恢复内容 (${i + 1}/${targetItems.length})...`);
  }
  onProgress?.(100, 'ZIP 全量备份导入成功！');
  return { importedNotebooks: targetNotebooks.length, importedItems: targetItems.length };
}
