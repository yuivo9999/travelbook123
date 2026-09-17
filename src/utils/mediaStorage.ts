/**
 * Persistent original-media storage.
 *
 * OPFS (Origin Private File System) is the primary store for original MP4/MOV/JPG/PNG
 * and other large binaries. IndexedDB keeps only metadata + small thumbnails.
 * FileSystemFileHandle is intentionally NOT part of this persistence layer.
 */

const ROOT_DIR = 'digital-notebook';
const MEDIA_DIR = 'media';
const MAX_LEGACY_INLINE_MEDIA = 4 * 1024 * 1024;

function hasOpfs(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator.storage as any)?.getDirectory;
}

async function getMediaDirectory(): Promise<any | null> {
  if (!hasOpfs()) return null;
  const root = await (navigator.storage as any).getDirectory();
  const appDir = await root.getDirectoryHandle(ROOT_DIR, { create: true });
  return appDir.getDirectoryHandle(MEDIA_DIR, { create: true });
}

function safeName(id: string): string {
  return encodeURIComponent(id).replace(/%/g, '_');
}

export function getMediaStorageKey(mediaId: string): string {
  return `${MEDIA_DIR}/${safeName(mediaId)}`;
}

export async function writeOriginalMedia(mediaId: string, blob: Blob): Promise<string | null> {
  if (!(blob instanceof Blob) || blob.size <= 0) throw new Error('原始媒体为空，无法保存。');
  const dir = await getMediaDirectory();
  if (!dir) return null;
  const file = await dir.getFileHandle(safeName(mediaId), { create: true });
  const writable = await file.createWritable();
  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
  return getMediaStorageKey(mediaId);
}

export async function readOriginalMedia(mediaId: string, mimeType = 'application/octet-stream'): Promise<Blob | null> {
  const dir = await getMediaDirectory();
  if (!dir) return null;
  try {
    const fileHandle = await dir.getFileHandle(safeName(mediaId));
    const file = await fileHandle.getFile();
    if (!file || file.size <= 0) return null;
    return file;
  } catch {
    return null;
  }
}

export async function deleteOriginalMedia(mediaId: string): Promise<void> {
  const dir = await getMediaDirectory();
  if (!dir) return;
  try { await dir.removeEntry(safeName(mediaId)); } catch { /* already absent */ }
}

export async function hasOriginalMedia(mediaId: string): Promise<boolean> {
  const dir = await getMediaDirectory();
  if (!dir) return false;
  try {
    const handle = await dir.getFileHandle(safeName(mediaId));
    const file = await handle.getFile();
    return file.size > 0;
  } catch {
    return false;
  }
}

export function canKeepLegacyInlineMedia(blob: Blob): boolean {
  return blob.size > 0 && blob.size <= MAX_LEGACY_INLINE_MEDIA;
}

export function isOpfsSupported(): boolean {
  return hasOpfs();
}
