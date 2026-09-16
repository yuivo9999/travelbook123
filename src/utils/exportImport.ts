import { Notebook, ContentItem, MediaRecord } from '../types';
import {
  getAllNotebooks,
  getAllItems,
  getItemsByNotebook,
  getMedia,
  saveNotebook,
  saveItem,
  saveMedia,
} from '../db/indexedDB';

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
  sourceUrl?: string; // 原始文件超链接或 file:// 路径
  thumbnailBase64?: string; // 轻量缩略图 Base64 (Data URI)
  fullBlobBase64?: string; // 完整原始媒体 Base64 (仅在 full 模式下包含)
}

export interface ScrapbookBackup {
  appName: 'Travelbook Digital Scrapbook';
  version: '2.0.0';
  exportType: 'full' | 'lightweight';
  scope: 'single' | 'all';
  exportedAt: string;
  notebooks: Notebook[];
  items: ContentItem[];
  media: ExportedMedia[];
}

export type ExportScope = 'all' | string; // 'all' or notebookId
export type ExportMode = 'full' | 'lightweight';

/**
 * 将 Blob 转为 Base64 Data URI
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => reject(new Error('转换媒体文件为 Base64 失败'));
    reader.readAsDataURL(blob);
  });
}

/**
 * 将 Base64 Data URI 或纯 Base64 转为 Blob
 */
export function base64ToBlob(base64Data: string, fallbackMime = 'application/octet-stream'): Blob {
  try {
    let byteCharacters: string;
    let mime = fallbackMime;

    if (base64Data.startsWith('data:')) {
      const parts = base64Data.split(',');
      const match = parts[0].match(/:(.*?);/);
      if (match && match[1]) {
        mime = match[1];
      }
      byteCharacters = atob(parts[1] || '');
    } else {
      byteCharacters = atob(base64Data);
    }

    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mime });
  } catch (err) {
    console.error('Failed to convert base64 to Blob', err);
    return new Blob([], { type: fallbackMime });
  }
}

/**
 * 导出指定手账或全部手账
 */
export async function exportScrapbookData(options: {
  targetNotebookId?: string | 'all';
  mode: ExportMode;
  onProgress?: (percent: number, status: string) => void;
}): Promise<void> {
  const { targetNotebookId = 'all', mode, onProgress } = options;

  onProgress?.(10, '正在读取手账数据...');

  // 1. 获取目标手账本
  const allNotebooks = await getAllNotebooks();
  const targetNotebooks =
    targetNotebookId === 'all'
      ? allNotebooks
      : allNotebooks.filter((nb) => nb.id === targetNotebookId);

  if (targetNotebooks.length === 0) {
    throw new Error('未找到要导出的手账本');
  }

  const targetNotebookIds = new Set(targetNotebooks.map((nb) => nb.id));

  // 2. 获取对应的贴图/便签项
  onProgress?.(25, '正在整理便签与排版...');
  const allItems = await getAllItems();
  const targetItems = allItems.filter((item) => targetNotebookIds.has(item.notebookId));

  // 3. 收集并处理媒体数据
  onProgress?.(40, '正在处理图片与视频预览...');
  const exportedMediaList: ExportedMedia[] = [];

  const mediaIds = Array.from(
    new Set(
      targetItems
        .map((item) => item.mediaId)
        .filter((id): id is string => Boolean(id && id.trim().length > 0))
    )
  );

  const totalMedia = mediaIds.length;
  let processedCount = 0;

  for (const mediaId of mediaIds) {
    processedCount++;
    const progress = Math.round(40 + (processedCount / Math.max(1, totalMedia)) * 45);
    onProgress?.(progress, `正在打包媒体 (${processedCount}/${totalMedia})...`);

    try {
      const media = await getMedia(mediaId);
      if (!media) continue;

      let thumbBase64: string | undefined;
      let fullBlobBase64: string | undefined;

      // 缩略图/预览图 (两者都会打包轻量缩略图)
      const blobForThumb = media.thumbnailBlob || (mode === 'lightweight' && media.type === 'image' ? media.blob : undefined);
      if (blobForThumb) {
        try {
          thumbBase64 = await blobToBase64(blobForThumb);
        } catch (e) {
          console.warn('Failed to encode thumbnail for media', mediaId, e);
        }
      }

      // 如果是全量备份模式，转换完整媒体 Blob 为 Base64
      if (mode === 'full' && media.blob) {
        try {
          fullBlobBase64 = await blobToBase64(media.blob);
        } catch (e) {
          console.warn('Failed to encode full blob for media', mediaId, e);
        }
      }

      // 构造原始文件超链接/路径
      const fileName = media.fileName || (media.type === 'video' ? 'video.mp4' : 'image.jpg');
      const sourceUrl = `file://${encodeURIComponent(fileName)}`;

      exportedMediaList.push({
        id: media.id,
        notebookId: media.notebookId,
        type: media.type,
        mimeType: media.mimeType,
        width: media.width,
        height: media.height,
        duration: media.duration,
        fileName: media.fileName,
        fileSize: media.fileSize,
        sourceUrl,
        thumbnailBase64: thumbBase64,
        fullBlobBase64,
      });
    } catch (e) {
      console.warn('Error reading media record during export', mediaId, e);
    }
  }

  onProgress?.(90, '正在生成并下载 JSON 备份...');

  // 4. 构造备份数据载荷
  const payload: ScrapbookBackup = {
    appName: 'Travelbook Digital Scrapbook',
    version: '2.0.0',
    exportType: mode,
    scope: targetNotebookId === 'all' ? 'all' : 'single',
    exportedAt: new Date().toISOString(),
    notebooks: targetNotebooks,
    items: targetItems.map((item) => {
      // 附加原始文件超链接信息方便轻量版直接消费
      const relatedMedia = exportedMediaList.find((m) => m.id === item.mediaId);
      return {
        ...item,
        originalFileName: relatedMedia?.fileName || (item as any).originalFileName,
        sourceUrl: relatedMedia?.sourceUrl || (item as any).sourceUrl,
      };
    }),
    media: exportedMediaList,
  };

  // 5. 触发浏览器下载
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 10);
  const nbName =
    targetNotebookId === 'all'
      ? '全部手账'
      : (targetNotebooks[0]?.title || '单本手账').replace(/[\\/:*?"<>|]/g, '_');
  const modeTag = mode === 'full' ? '全部完整媒体' : '轻量缩略图与超链接';
  const filename = `手账备份_${nbName}_${modeTag}_${dateStr}.json`;

  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = downloadUrl;
  downloadAnchor.download = filename;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
  onProgress?.(100, '导出完成！');
}

/**
 * 解析并验证导入文件内容
 */
export async function parseBackupFile(file: File): Promise<ScrapbookBackup> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);

        if (!data || !Array.isArray(data.notebooks) || !Array.isArray(data.items)) {
          throw new Error('无效的手账备份文件格式，未检测到手账本或内容列表');
        }

        const backup: ScrapbookBackup = {
          appName: data.appName || 'Travelbook Digital Scrapbook',
          version: data.version || '1.0.0',
          exportType: data.exportType || (data.media?.some((m: any) => m.fullBlobBase64) ? 'full' : 'lightweight'),
          scope: data.scope || (data.notebooks.length === 1 ? 'single' : 'all'),
          exportedAt: data.exportedAt || new Date().toISOString(),
          notebooks: data.notebooks,
          items: data.items,
          media: Array.isArray(data.media) ? data.media : [],
        };

        resolve(backup);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('备份文件解析失败，请确保是有效的 JSON 文件'));
      }
    };
    reader.onerror = () => reject(new Error('读取本地文件失败'));
    reader.readAsText(file);
  });
}

/**
 * 执行选择性导入
 */
export async function executeImport(options: {
  backup: ScrapbookBackup;
  selectedNotebookIds: string[];
  importMode: 'full' | 'lightweight';
  nameHandling: 'copy' | 'overwrite';
  onProgress?: (percent: number, status: string) => void;
}): Promise<{ importedNotebooks: number; importedItems: number }> {
  const { backup, selectedNotebookIds, importMode, nameHandling, onProgress } = options;

  const targetNotebooks = backup.notebooks.filter((nb) => selectedNotebookIds.includes(nb.id));
  if (targetNotebooks.length === 0) {
    throw new Error('未选择任何要导入的手账本');
  }

  const existingNotebooks = await getAllNotebooks();
  const existingIds = new Set(existingNotebooks.map((nb) => nb.id));
  const existingTitles = new Set(existingNotebooks.map((nb) => nb.title));

  onProgress?.(10, '正在准备导入手账本...');

  // ID 映射（如果选择 copy 创建副本，重新生成 ID 避免冲突）
  const notebookIdMap = new Map<string, string>();

  let nbIndex = 0;
  for (const nb of targetNotebooks) {
    nbIndex++;
    let finalId = nb.id;
    let finalTitle = nb.title;

    if (nameHandling === 'copy' && (existingIds.has(nb.id) || existingTitles.has(nb.title))) {
      finalId = 'nb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      finalTitle = `${nb.title} (导入副本)`;
    }

    notebookIdMap.set(nb.id, finalId);

    await saveNotebook({
      ...nb,
      id: finalId,
      title: finalTitle,
      updatedAt: Date.now(),
    });
  }

  // 导入媒体数据
  const mediaMap = new Map<string, ExportedMedia>();
  if (Array.isArray(backup.media)) {
    backup.media.forEach((m) => mediaMap.set(m.id, m));
  }

  const targetItems = backup.items.filter((it) => selectedNotebookIds.includes(it.notebookId));
  const totalItems = targetItems.length;
  let processedItems = 0;

  onProgress?.(30, '正在导入图片、视频与便签卡片...');

  for (const item of targetItems) {
    processedItems++;
    const percent = Math.round(30 + (processedItems / Math.max(1, totalItems)) * 60);
    onProgress?.(percent, `正在恢复内容 (${processedItems}/${totalItems})...`);

    const newNotebookId = notebookIdMap.get(item.notebookId) || item.notebookId;

    // 检查并恢复媒体
    if (item.mediaId && mediaMap.has(item.mediaId)) {
      const expMedia = mediaMap.get(item.mediaId)!;

      let thumbBlob: Blob | undefined;
      let fullBlob: Blob | undefined;

      // 缩略图
      if (expMedia.thumbnailBase64) {
        thumbBlob = base64ToBlob(expMedia.thumbnailBase64, 'image/jpeg');
      }

      // 原图/原视频
      if (importMode === 'full' && expMedia.fullBlobBase64) {
        fullBlob = base64ToBlob(expMedia.fullBlobBase64, expMedia.mimeType);
      } else {
        // 轻量模式或没有大媒体：将缩略图作为展示 blob 恢复，节约空间同时保有预览！
        fullBlob = thumbBlob || new Blob([], { type: expMedia.mimeType });
      }

      const mediaRecord: MediaRecord = {
        id: expMedia.id,
        notebookId: newNotebookId,
        type: expMedia.type,
        mimeType: expMedia.mimeType,
        blob: fullBlob,
        thumbnailBlob: thumbBlob,
        width: expMedia.width,
        height: expMedia.height,
        duration: expMedia.duration,
        fileName: expMedia.fileName,
        fileSize: expMedia.fileSize,
        createdAt: Date.now(),
      };

      try {
        await saveMedia(mediaRecord);
      } catch (err) {
        console.warn('Failed to save imported media record', expMedia.id, err);
      }
    }

    // 保存 ContentItem
    await saveItem({
      ...item,
      notebookId: newNotebookId,
      updatedAt: Date.now(),
    });
  }

  onProgress?.(100, '导入成功！');

  return {
    importedNotebooks: targetNotebooks.length,
    importedItems: targetItems.length,
  };
}
