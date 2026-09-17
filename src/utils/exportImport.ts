import { Notebook, ContentItem, MediaRecord } from '../types';
import {
  getAllNotebooks,
  getAllItems,
  getMedia,
  saveNotebook,
  saveItem,
  saveMedia,
} from '../db/indexedDB';
import { getOriginalMediaBlob, processImageFile, processVideoFile } from './media';

const BACKUP_APP_NAME = 'Travelbook Digital Scrapbook' as const;
const BACKUP_VERSION = '4.0.0' as const;
const ZIP_COMPRESSION_POLICY = 'balanced' as const;
const ZIP_COMPRESSION_MIN_SIZE = 4 * 1024;
const ZIP_COMPRESSION_MIN_SAVING_RATIO = 0.08;
const PRECOMPRESSED_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.avif', '.zip', '.gz', '.7z', '.rar']);
const BACKUP_EXTENSION = '.zip';
const DATA_FILE = 'data.json';
const MANIFEST_FILE = 'manifest.json';

export interface ExportedMedia {
  id: string;
  notebookId: string;
  type: 'image' | 'video';
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
  fileName?: string;
  fileSize?: number;
  sourceUrl?: string;
  archivePath: string;
}

export interface ScrapbookBackup {
  appName: typeof BACKUP_APP_NAME;
  version: string;
  exportType: 'full';
  scope: 'single' | 'all';
  exportedAt: string;
  notebooks: Notebook[];
  items: ContentItem[];
  media: ExportedMedia[];
  /** Full media blobs are kept in memory only while an archive is being imported. */
  mediaBlobs: Map<string, Blob>;
  compression?: { policy: 'balanced'; archiveSize: number; uncompressedSize: number; ratio: number };
}

export type ExportScope = 'all' | string;
export type ExportMode = 'full';

type ZipEntry = { name: string; data: Uint8Array; compress?: boolean };

type PreparedZipEntry = {
  name: string;
  originalSize: number;
  compressedData: Uint8Array;
  compressedSize: number;
  crc: number;
  method: 0 | 8;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    // Browser `deflate` is zlib-wrapped. ZIP method 8 needs the raw DEFLATE payload,
    // so remove the 2-byte zlib header and 4-byte Adler-32 trailer.
    const stream = new CompressionStream('deflate');
    const writer = stream.writable.getWriter();
    await writer.write(data as Uint8Array<ArrayBuffer>);
    await writer.close();
    const compressed = new Uint8Array(await new Response(stream.readable).arrayBuffer());
    if (compressed.length <= 6) return null;
    return compressed.slice(2, -4);
  } catch {
    return null;
  }
}

declare global {
  interface Window {
    pako?: { inflateRaw: (data: Uint8Array) => Uint8Array };
  }
}

async function inflateRaw(data: Uint8Array, expectedSize: number): Promise<Uint8Array> {
  // First use the browser-native decoder.
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const RawDecompressionStream = DecompressionStream as unknown as new (format: string) => DecompressionStream;
      const stream = new RawDecompressionStream('deflate-raw');
      const writer = stream.writable.getWriter();
      await writer.write(data as Uint8Array<ArrayBuffer>);
      await writer.close();
      const result = new Uint8Array(await new Response(stream.readable).arrayBuffer());
      if (expectedSize !== result.length) throw new Error('ZIP 压缩数据解压后的大小不匹配。');
      return result;
    } catch {
      // Fall through to the compatibility decoder below.
    }
  }

  // Compatibility fallback for browsers whose DecompressionStream lacks
  // `deflate-raw`. pako is bundled locally, so importing a backup does not
  // depend on network access or a package install at runtime.
  try {
    const pako = typeof window !== 'undefined' ? window.pako : undefined;
    if (pako?.inflateRaw) {
      const result = pako.inflateRaw(data);
      if (expectedSize !== result.length) throw new Error('ZIP 压缩数据解压后的大小不匹配。');
      return result;
    }
  } catch {
    // Report the common compatibility error below.
  }

  throw new Error('当前浏览器无法解压 ZIP 的 DEFLATE 数据，请更新浏览器后重试。');
}

function safeArchiveName(name: string | undefined, fallback: string): string {
  const cleaned = (name || fallback).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim();
  return cleaned || fallback;
}

function writeU16(view: DataView, offset: number, value: number) { view.setUint16(offset, value, true); }
function writeU32(view: DataView, offset: number, value: number) { view.setUint32(offset, value >>> 0, true); }

function shouldCompressEntry(name: string, data: Uint8Array, explicit?: boolean): boolean {
  if (explicit === false || data.length < ZIP_COMPRESSION_MIN_SIZE) return false;
  const lower = name.toLowerCase();
  for (const ext of PRECOMPRESSED_EXTENSIONS) if (lower.endsWith(ext)) return false;
  return explicit === true || name === DATA_FILE || name === MANIFEST_FILE;
}

async function prepareZipEntries(entries: ZipEntry[]): Promise<PreparedZipEntry[]> {
  const prepared: PreparedZipEntry[] = [];
  for (const entry of entries) {
    const original = entry.data;
    const crc = crc32(original);
    let method: 0 | 8 = 0;
    let payload = original;
    if (ZIP_COMPRESSION_POLICY === 'balanced' && shouldCompressEntry(entry.name, original, entry.compress)) {
      const candidate = await deflateRaw(original);
      if (candidate && candidate.length < original.length * (1 - ZIP_COMPRESSION_MIN_SAVING_RATIO)) {
        payload = candidate;
        method = 8;
      }
    }
    prepared.push({
      name: entry.name,
      originalSize: original.length,
      compressedData: payload,
      compressedSize: payload.length,
      crc,
      method,
    });
  }
  return prepared;
}

/**
 * Balanced ZIP policy: compress metadata/text, but store already-compressed media.
 * This is intentionally asynchronous so compression does not block the UI as one
 * giant synchronous operation.
 */
async function createZip(entries: ZipEntry[]): Promise<{ blob: Blob; uncompressedSize: number }> {
  const prepared = await prepareZipEntries(entries);
  const uncompressedSize = prepared.reduce((sum, entry) => sum + entry.originalSize, 0);
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of prepared) {
    const name = textEncoder.encode(entry.name);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    writeU32(lv, 0, 0x04034b50);
    writeU16(lv, 4, 20);
    writeU16(lv, 6, 0x0800);
    writeU16(lv, 8, entry.method);
    writeU16(lv, 10, 0); writeU16(lv, 12, 0); writeU16(lv, 14, 0);
    writeU32(lv, 14, entry.crc);
    writeU32(lv, 18, entry.compressedSize);
    writeU32(lv, 22, entry.originalSize);
    writeU16(lv, 26, name.length); writeU16(lv, 28, 0);
    local.set(name, 30);
    localParts.push(local, entry.compressedData);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    writeU32(cv, 0, 0x02014b50);
    writeU16(cv, 4, 20); writeU16(cv, 6, 20);
    writeU16(cv, 8, 0x0800); writeU16(cv, 10, entry.method);
    writeU16(cv, 12, 0); writeU16(cv, 14, 0); writeU32(cv, 16, entry.crc);
    writeU32(cv, 20, entry.compressedSize); writeU32(cv, 24, entry.originalSize);
    writeU16(cv, 28, name.length); writeU16(cv, 30, 0); writeU16(cv, 32, 0);
    writeU16(cv, 34, 0); writeU16(cv, 36, 0); writeU32(cv, 38, 0); writeU32(cv, 42, offset);
    central.set(name, 46);
    centralParts.push(central);
    offset += local.length + entry.compressedSize;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  writeU32(ev, 0, 0x06054b50); writeU16(ev, 4, 0); writeU16(ev, 6, 0);
  writeU16(ev, 8, prepared.length); writeU16(ev, 10, prepared.length);
  writeU32(ev, 12, centralSize); writeU32(ev, 16, offset); writeU16(ev, 20, 0);
  const blob = new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
  return { blob, uncompressedSize };
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const min = Math.max(0, bytes.length - 0xffff - 22);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      return i;
    }
  }
  return -1;
}

type ZipReadEntry = { blob: Blob; crc: number; size: number; compressed: boolean };

async function readZipEntries(file: File): Promise<Map<string, ZipReadEntry>> {
  // Read only the tail first. This avoids loading a multi-GB backup into one ArrayBuffer.
  const tailSize = Math.min(file.size, 0xffff + 22);
  const tailBytes = new Uint8Array(await file.slice(file.size - tailSize).arrayBuffer());
  let eocdRelative = -1;
  for (let i = tailBytes.length - 22; i >= 0; i--) {
    if (tailBytes[i] === 0x50 && tailBytes[i + 1] === 0x4b && tailBytes[i + 2] === 0x05 && tailBytes[i + 3] === 0x06) {
      eocdRelative = i;
      break;
    }
  }
  if (eocdRelative < 0) throw new Error('无效的 ZIP 备份文件：未找到 ZIP 目录。');

  const eocd = new DataView(tailBytes.buffer, tailBytes.byteOffset, tailBytes.byteLength);
  const entryCount = eocd.getUint16(eocdRelative + 10, true);
  const centralSize = eocd.getUint32(eocdRelative + 12, true);
  const centralOffset = eocd.getUint32(eocdRelative + 16, true);
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
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const crc = view.getUint32(cursor + 16, true);
    const name = textDecoder.decode(centralBytes.slice(cursor + 46, cursor + 46 + nameLength));

    if (flags & 0x0001) throw new Error(`备份文件包含加密条目，无法导入：${name}`);
    if (method !== 0 && method !== 8) throw new Error(`备份文件使用了暂不支持的压缩方式：${name}`);
    if (localOffset + 30 > file.size) throw new Error(`ZIP 条目损坏：${name}`);

    const localHeader = new Uint8Array(await file.slice(localOffset, localOffset + 30).arrayBuffer());
    const localView = new DataView(localHeader.buffer, localHeader.byteOffset, localHeader.byteLength);
    if (localView.getUint32(0, true) !== 0x04034b50) throw new Error(`ZIP 条目头损坏：${name}`);
    const localNameLength = localView.getUint16(26, true);
    const localExtraLength = localView.getUint16(28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > file.size) throw new Error(`ZIP 条目大小异常：${name}`);

    result.set(name, { blob: file.slice(dataStart, dataEnd), crc, size: uncompressedSize, compressed: method === 8 });
    cursor += 46 + nameLength + extraLength + commentLength;
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
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function generateId(prefix: string): string {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${uuid}`;
}

function buildDataJson(backup: Omit<ScrapbookBackup, 'mediaBlobs'>): Uint8Array {
  return textEncoder.encode(JSON.stringify({
    appName: backup.appName,
    version: backup.version,
    exportType: backup.exportType,
    scope: backup.scope,
    exportedAt: backup.exportedAt,
    notebooks: backup.notebooks,
    items: backup.items,
    media: backup.media,
  }));
}

function buildManifest(backup: Omit<ScrapbookBackup, 'mediaBlobs'>): Uint8Array {
  return textEncoder.encode(JSON.stringify({
    format: 'digital-scrapbook-zip',
    formatVersion: backup.version,
    appName: backup.appName,
    exportType: backup.exportType,
    scope: backup.scope,
    exportedAt: backup.exportedAt,
    notebookCount: backup.notebooks.length,
    itemCount: backup.items.length,
    mediaCount: backup.media.length,
  }, null, 2));
}

/** Export a full backup as a ZIP archive. Scope can be one notebook or the whole app. */
export async function exportScrapbookData(options: {
  targetNotebookId?: string | 'all';
  mode?: ExportMode;
  onProgress?: (percent: number, status: string) => void;
}): Promise<void> {
  const { targetNotebookId = 'all', onProgress } = options;
  onProgress?.(5, '正在读取手账数据...');

  const allNotebooks = await getAllNotebooks();
  const targetNotebooks = targetNotebookId === 'all'
    ? allNotebooks
    : allNotebooks.filter((nb) => nb.id === targetNotebookId);
  if (!targetNotebooks.length) throw new Error('未找到要导出的手账本');

  const targetNotebookIds = new Set(targetNotebooks.map((nb) => nb.id));
  const targetItems = (await getAllItems()).filter((item) => targetNotebookIds.has(item.notebookId));
  const mediaIds = Array.from(new Set([
    ...targetItems.map((item) => item.mediaId).filter((id): id is string => Boolean(id?.trim())),
    ...targetNotebooks.map((nb) => nb.coverImageId).filter((id): id is string => Boolean(id?.trim())),
  ]));

  const mediaEntries: ExportedMedia[] = [];
  const zipEntries: ZipEntry[] = [];
  const mediaById = new Map<string, ExportedMedia>();

  onProgress?.(20, '正在读取高清照片与原始视频...');
  for (let i = 0; i < mediaIds.length; i++) {
    const mediaId = mediaIds[i];
    onProgress?.(20 + Math.round(((i + 1) / Math.max(1, mediaIds.length)) * 65), `正在打包媒体 (${i + 1}/${mediaIds.length})...`);
    const media = await getMedia(mediaId);
    if (!media) throw new Error(`找不到媒体文件：${mediaId}`);

    const rawBlob = await getOriginalMediaBlob(media);
    if (!rawBlob || rawBlob.size === 0) {
      throw new Error(`媒体“${media.fileName || mediaId}”缺少完整原始文件，已停止导出，避免生成不完整备份。`);
    }

    const fileName = safeArchiveName(media.fileName, media.type === 'video' ? `video_${mediaId}.mp4` : `image_${mediaId}.jpg`);
    const archivePath = `media/${String(i + 1).padStart(4, '0')}_${fileName}`;
    const mediaMeta: ExportedMedia = {
      id: media.id,
      notebookId: media.notebookId,
      type: media.type,
      mimeType: media.mimeType,
      width: media.width,
      height: media.height,
      duration: media.duration,
      fileName: media.fileName,
      fileSize: media.fileSize ?? rawBlob.size,
      sourceUrl: undefined,
      archivePath,
    };
    mediaEntries.push(mediaMeta);
    mediaById.set(media.id, mediaMeta);
    zipEntries.push({ name: archivePath, data: new Uint8Array(await rawBlob.arrayBuffer()) });
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
      return {
        ...item,
        originalFileName: related?.fileName || (item as any).originalFileName,
        sourceUrl: related?.sourceUrl || (item as any).sourceUrl,
      };
    }),
    media: mediaEntries,
  };

  onProgress?.(90, '正在生成 ZIP 备份包...');
  zipEntries.unshift(
    { name: MANIFEST_FILE, data: buildManifest(backupWithoutBlobs) },
    { name: DATA_FILE, data: buildDataJson(backupWithoutBlobs) },
  );

  onProgress?.(94, '正在按均衡压缩策略生成 ZIP...');
  const zipResult = await createZip(zipEntries);
  const zipBlob = zipResult.blob;
  const compressionRatio = zipResult.uncompressedSize > 0 ? zipBlob.size / zipResult.uncompressedSize : 1;
  const dateStr = new Date().toISOString().slice(0, 10);
  const nbName = targetNotebookId === 'all'
    ? '全部手账'
    : safeArchiveName(targetNotebooks[0]?.title, '单本手账');
  downloadBlob(zipBlob, `手账全量备份_${nbName}_${dateStr}${BACKUP_EXTENSION}`);
  onProgress?.(100, `ZIP 全量备份导出完成（均衡策略，归档体积约为原始数据的 ${(compressionRatio * 100).toFixed(1)}%）！`);
}

/** Parse only the new ZIP backup format. Standalone JSON backups are intentionally unsupported. */
export async function parseBackupFile(file: File): Promise<ScrapbookBackup> {
  if (!file.name.toLowerCase().endsWith('.zip') && file.type !== 'application/zip') {
    throw new Error('只支持 ZIP 全量备份文件（.zip），旧版 JSON 备份不再作为导入格式。');
  }

  const entries = await readZipEntries(file);
  const dataEntry = entries.get(DATA_FILE);
  if (!dataEntry) throw new Error('无效的手账 ZIP 备份：缺少数据文件。');

  let data: any;
  try {
    const rawBytes = new Uint8Array(await dataEntry.blob.arrayBuffer());
    const dataBytes = dataEntry.compressed ? await inflateRaw(rawBytes, dataEntry.size) : rawBytes;
    if (crc32(dataBytes) !== dataEntry.crc) throw new Error('手账 ZIP 备份的数据校验失败。');
    data = JSON.parse(textDecoder.decode(dataBytes));
  } catch {
    throw new Error('手账 ZIP 备份的数据文件损坏。');
  }

  if (!data || !Array.isArray(data.notebooks) || !Array.isArray(data.items) || !Array.isArray(data.media)) {
    throw new Error('无效的手账 ZIP 备份：缺少手账本、内容或媒体数据。');
  }
  if (data.exportType !== 'full') throw new Error('该备份不是全量备份，无法导入。');

  const mediaBlobs = new Map<string, Blob>();
  const media: ExportedMedia[] = [];
  let uncompressedSize = dataEntry.size;
  for (const meta of data.media as ExportedMedia[]) {
    const entry = meta.archivePath ? entries.get(meta.archivePath) : undefined;
    if (!entry) throw new Error(`备份缺少媒体文件：${meta.fileName || meta.id}`);
    uncompressedSize += entry.size;
    // Keep the ZIP slice as a Blob instead of materializing every large MP4/MOV/JPG/PNG in RAM.
    if (entry.compressed) {
      const compressedBytes = new Uint8Array(await entry.blob.arrayBuffer());
      const restored = await inflateRaw(compressedBytes, entry.size);
      if (crc32(restored) !== entry.crc) throw new Error(`媒体校验失败：${meta.fileName || meta.id}`);
      mediaBlobs.set(meta.id, new Blob([restored], { type: meta.mimeType || 'application/octet-stream' }));
    } else {
      mediaBlobs.set(meta.id, entry.blob.slice(0, entry.blob.size, meta.mimeType || 'application/octet-stream'));
    }
    media.push(meta);
  }

  return {
    appName: data.appName || BACKUP_APP_NAME,
    version: data.version || BACKUP_VERSION,
    exportType: 'full',
    scope: data.scope === 'single' ? 'single' : 'all',
    exportedAt: data.exportedAt || new Date().toISOString(),
    notebooks: data.notebooks,
    items: data.items,
    media,
    mediaBlobs,
    compression: {
      policy: 'balanced',
      archiveSize: file.size,
      uncompressedSize,
      ratio: uncompressedSize > 0 ? file.size / uncompressedSize : 1,
    },
  };
}

/** Execute full ZIP restore. Copy mode remaps notebook, item and media IDs. */
export async function executeImport(options: {
  backup: ScrapbookBackup;
  selectedNotebookIds: string[];
  importMode?: 'full';
  nameHandling: 'copy' | 'overwrite';
  onProgress?: (percent: number, status: string) => void;
}): Promise<{ importedNotebooks: number; importedItems: number }> {
  const { backup, selectedNotebookIds, nameHandling, onProgress } = options;
  if (backup.exportType !== 'full') throw new Error('只允许导入全量 ZIP 备份。');

  const targetNotebooks = backup.notebooks.filter((nb) => selectedNotebookIds.includes(nb.id));
  if (!targetNotebooks.length) throw new Error('未选择任何要导入的手账本');

  const existingNotebooks = await getAllNotebooks();
  const existingIds = new Set(existingNotebooks.map((nb) => nb.id));
  const existingTitles = new Set(existingNotebooks.map((nb) => nb.title));
  const notebookIdMap = new Map<string, string>();
  const itemIdMap = new Map<string, string>();
  const mediaIdMap = new Map<string, string>();

  onProgress?.(10, '正在建立完整 ID 映射...');
  for (const nb of targetNotebooks) {
    const conflict = existingIds.has(nb.id) || existingTitles.has(nb.title);
    const finalId = nameHandling === 'copy' ? generateId('nb') : nb.id;
    notebookIdMap.set(nb.id, finalId);
    if (nameHandling === 'copy' && conflict) {
      // Still use a fresh ID; conflict detection is retained for diagnostics/readability.
    }
  }

  const targetItems = backup.items.filter((item) => selectedNotebookIds.includes(item.notebookId));
  const targetMediaIds = new Set([
    ...targetItems.map((item) => item.mediaId).filter((id): id is string => Boolean(id)),
    ...targetNotebooks.map((nb) => nb.coverImageId).filter((id): id is string => Boolean(id)),
  ]);
  const targetMedia = backup.media.filter((media) => targetMediaIds.has(media.id));

  if (nameHandling === 'copy') {
    for (const item of targetItems) itemIdMap.set(item.id, generateId('item'));
    for (const media of targetMedia) mediaIdMap.set(media.id, generateId('media'));
  } else {
    for (const item of targetItems) itemIdMap.set(item.id, item.id);
    for (const media of targetMedia) mediaIdMap.set(media.id, media.id);
  }

  for (const nb of targetNotebooks) {
    const finalId = notebookIdMap.get(nb.id) || nb.id;
    const finalTitle = nameHandling === 'copy' && existingTitles.has(nb.title)
      ? `${nb.title} (导入副本)`
      : (nameHandling === 'copy' ? `${nb.title} (导入副本)` : nb.title);
    await saveNotebook({
      ...nb,
      id: finalId,
      title: finalTitle,
      coverImageId: nb.coverImageId ? (mediaIdMap.get(nb.coverImageId) || nb.coverImageId) : nb.coverImageId,
      updatedAt: Date.now(),
    });
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
    } catch {
      thumbnailBlob = undefined;
    }

    const mediaRecord: MediaRecord = {
      id: mediaIdMap.get(expMedia.id) || expMedia.id,
      notebookId: newNotebookId,
      type: expMedia.type,
      mimeType: expMedia.mimeType,
      blob,
      thumbnailBlob,
      storageKey: undefined,
      width: expMedia.width,
      height: expMedia.height,
      duration: expMedia.duration,
      fileName: expMedia.fileName,
      fileSize: expMedia.fileSize ?? blob.size,
      createdAt: Date.now(),
    };
    await saveMedia(mediaRecord);
    onProgress?.(25 + Math.round(((i + 1) / Math.max(1, targetMedia.length)) * 45), `正在恢复媒体 (${i + 1}/${targetMedia.length})...`);
  }

  onProgress?.(72, '正在恢复手账排版与内容...');
  for (let i = 0; i < targetItems.length; i++) {
    const item = targetItems[i];
    const newNotebookId = notebookIdMap.get(item.notebookId) || item.notebookId;
    const newMediaId = item.mediaId ? (mediaIdMap.get(item.mediaId) || item.mediaId) : item.mediaId;
    await saveItem({
      ...item,
      id: itemIdMap.get(item.id) || item.id,
      notebookId: newNotebookId,
      mediaId: newMediaId,
      updatedAt: Date.now(),
    });
    onProgress?.(72 + Math.round(((i + 1) / Math.max(1, targetItems.length)) * 28), `正在恢复内容 (${i + 1}/${targetItems.length})...`);
  }

  onProgress?.(100, 'ZIP 全量备份导入成功！');
  return { importedNotebooks: targetNotebooks.length, importedItems: targetItems.length };
}
