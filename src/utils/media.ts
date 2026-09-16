/**
 * Media processing utilities for digital scrapbook:
 * - Image thumbnail generation with multi-format fallback (WebP -> JPEG -> PNG -> original)
 * - Video thumbnail generation via HTML5 video + canvas with preload 'auto' and frame capture
 * - Safe Blob URL creation and conversion helpers
 */

export interface ImageProcessResult {
  thumbnailBlob: Blob;
  width: number;
  height: number;
}

export interface VideoProcessResult {
  thumbnailBlob: Blob | null;
  duration: number;
  width: number;
  height: number;
}

/**
 * Safely convert any raw stored data into a real Blob instance
 */
export function ensureBlob(raw: unknown, mimeType = 'application/octet-stream'): Blob | null {
  if (!raw) return null;
  if (raw instanceof Blob) return raw;
  if (raw instanceof ArrayBuffer) return new Blob([raw], { type: mimeType });
  if (ArrayBuffer.isView(raw)) return new Blob([raw.buffer], { type: mimeType });
  if (typeof raw === 'string') {
    if (raw.startsWith('data:')) {
      try {
        const parts = raw.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : mimeType;
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
      } catch {
        return null;
      }
    }
    return null;
  }
  try {
    return new Blob([raw as BlobPart], { type: mimeType });
  } catch {
    return null;
  }
}

/**
 * Create a safe Object URL from a Blob or raw data
 */
export function createSafeBlobUrl(raw: unknown, mimeType?: string): string | null {
  if (!raw) return null;
  if (typeof raw === 'string' && (raw.startsWith('blob:') || raw.startsWith('data:') || raw.startsWith('http'))) {
    return raw;
  }
  const blob = ensureBlob(raw, mimeType);
  if (!blob) return null;
  try {
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('Failed to create object URL', err);
    return null;
  }
}

export async function processImageFile(file: File | Blob, maxWidth = 640): Promise<ImageProcessResult> {
  return new Promise((resolve) => {
    const rawBlob = ensureBlob(file, (file as File).type || 'image/jpeg') || file;
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(rawBlob);
    } catch {
      resolve({ thumbnailBlob: rawBlob as Blob, width: 400, height: 300 });
      return;
    }

    let isSettled = false;
    // 2s safety timer: ensures promise NEVER hangs on unexpected browser image load issues
    const safetyTimer = window.setTimeout(() => {
      if (isSettled) return;
      isSettled = true;
      try { URL.revokeObjectURL(objectUrl); } catch {}
      resolve({ thumbnailBlob: rawBlob as Blob, width: 400, height: 300 });
    }, 2000);

    const img = new Image();

    img.onload = () => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(safetyTimer);
      try { URL.revokeObjectURL(objectUrl); } catch {}

      const originalWidth = img.naturalWidth || img.width || 400;
      const originalHeight = img.naturalHeight || img.height || 300;

      let targetWidth = originalWidth;
      let targetHeight = originalHeight;

      if (targetWidth > maxWidth) {
        const ratio = maxWidth / targetWidth;
        targetWidth = maxWidth;
        targetHeight = Math.round(originalHeight * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ thumbnailBlob: rawBlob as Blob, width: originalWidth, height: originalHeight });
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      try {
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      } catch {
        resolve({ thumbnailBlob: rawBlob as Blob, width: originalWidth, height: originalHeight });
        return;
      }

      // Try webp first, then jpeg
      canvas.toBlob(
        (webpBlob) => {
          if (webpBlob && webpBlob.size > 0) {
            resolve({ thumbnailBlob: webpBlob, width: originalWidth, height: originalHeight });
          } else {
            canvas.toBlob(
              (jpegBlob) => {
                if (jpegBlob && jpegBlob.size > 0) {
                  resolve({ thumbnailBlob: jpegBlob, width: originalWidth, height: originalHeight });
                } else {
                  resolve({ thumbnailBlob: rawBlob as Blob, width: originalWidth, height: originalHeight });
                }
              },
              'image/jpeg',
              0.88
            );
          }
        },
        'image/webp',
        0.88
      );
    };

    img.onerror = () => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(safetyTimer);
      try { URL.revokeObjectURL(objectUrl); } catch {}
      // Graceful fallback: do not throw or reject, preserve the original image!
      resolve({ thumbnailBlob: rawBlob as Blob, width: 400, height: 300 });
    };

    img.src = objectUrl;
  });
}

export function createPlaceholderVideoThumbnail(title?: string, duration?: number): Blob {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Rich vintage dark film canvas
    const gradient = ctx.createLinearGradient(0, 0, 480, 320);
    gradient.addColorStop(0, '#24201D');
    gradient.addColorStop(1, '#151312');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 480, 320);

    // Film strip borders (top & bottom sprocket holes)
    ctx.fillStyle = '#3A322C';
    ctx.fillRect(0, 0, 480, 24);
    ctx.fillRect(0, 296, 480, 24);

    ctx.fillStyle = '#151312';
    for (let i = 12; i < 480; i += 32) {
      ctx.fillRect(i, 6, 16, 12);
      ctx.fillRect(i, 302, 16, 12);
    }

    // Play icon badge in center
    ctx.beginPath();
    ctx.arc(240, 160, 38, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(235, 220, 200, 0.22)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#D6C5B0';
    ctx.stroke();

    // Play triangle
    ctx.beginPath();
    ctx.moveTo(232, 142);
    ctx.lineTo(256, 160);
    ctx.lineTo(232, 178);
    ctx.closePath();
    ctx.fillStyle = '#FAF7F2';
    ctx.fill();

    // Optional duration or title stamp at bottom
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#B4A698';
    ctx.textAlign = 'center';
    const label = title || '视频剪辑';
    ctx.fillText(label.length > 28 ? label.slice(0, 26) + '...' : label, 240, 235);

    if (duration && duration > 0) {
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#8C7E70';
      ctx.fillText(formatDuration(duration), 240, 255);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const blob = ensureBlob(dataUrl, 'image/jpeg');
    if (blob) return blob;
  }

  // Pure binary 1x1 fallback if canvas context is unavailable
  return new Blob([''], { type: 'image/jpeg' });
}

export async function processVideoFile(file: File | Blob): Promise<VideoProcessResult> {
  return new Promise((resolve) => {
    const fileName = (file as File).name || 'video.mp4';
    const rawBlob = ensureBlob(file, (file as File).type || 'video/mp4') || file;
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(rawBlob);
    } catch {
      const fallbackThumb = createPlaceholderVideoThumbnail(fileName);
      resolve({ thumbnailBlob: fallbackThumb, duration: 0, width: 320, height: 240 });
      return;
    }

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    video.src = objectUrl;

    let timeoutId: number;
    let isResolved = false;

    const cleanup = () => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeoutId);
      try { URL.revokeObjectURL(objectUrl); } catch {}
      video.removeAttribute('src');
      video.load();
    };

    const finish = (result: VideoProcessResult) => {
      cleanup();
      // If thumbnail capture was null, always ensure a beautiful fallback thumbnail
      if (!result.thumbnailBlob) {
        result.thumbnailBlob = createPlaceholderVideoThumbnail(fileName, result.duration);
      }
      resolve(result);
    };

    const captureCurrentFrame = (width: number, height: number): Blob | null => {
      if (!width || !height || width <= 0 || height <= 0) return null;
      try {
        const maxWidth = 540;
        let targetWidth = width;
        let targetHeight = height;

        if (targetWidth > maxWidth) {
          const ratio = maxWidth / targetWidth;
          targetWidth = maxWidth;
          targetHeight = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          return ensureBlob(dataUrl, 'image/jpeg');
        }
      } catch (err) {
        console.warn('Canvas frame capture failed', err);
      }
      return null;
    };

    // 1.2s timeout fallback: never keep user waiting long for video adding
    timeoutId = window.setTimeout(() => {
      if (isResolved) return;
      const duration = isFinite(video.duration) ? video.duration : 0;
      const originalWidth = video.videoWidth || 320;
      const originalHeight = video.videoHeight || 240;
      const frameBlob = (originalWidth > 0 && originalHeight > 0)
        ? captureCurrentFrame(originalWidth, originalHeight)
        : null;
      finish({
        thumbnailBlob: frameBlob || createPlaceholderVideoThumbnail(fileName, duration),
        duration,
        width: originalWidth,
        height: originalHeight,
      });
    }, 1200);

    const onDataReady = () => {
      const duration = isFinite(video.duration) ? video.duration : 0;
      const originalWidth = video.videoWidth || 320;
      const originalHeight = video.videoHeight || 240;

      if (originalWidth <= 0 || originalHeight <= 0) {
        return;
      }

      // Seek slightly past 0s for good thumbnail frame
      const seekTime = duration > 1 ? 0.3 : 0.05;

      const handleSeeked = () => {
        const frameBlob = captureCurrentFrame(originalWidth, originalHeight);
        finish({
          thumbnailBlob: frameBlob || createPlaceholderVideoThumbnail(fileName, duration),
          duration,
          width: originalWidth,
          height: originalHeight,
        });
      };

      video.addEventListener('seeked', handleSeeked, { once: true });

      try {
        video.currentTime = seekTime;
      } catch {
        const frameBlob = captureCurrentFrame(originalWidth, originalHeight);
        finish({
          thumbnailBlob: frameBlob || createPlaceholderVideoThumbnail(fileName, duration),
          duration,
          width: originalWidth,
          height: originalHeight,
        });
      }
    };

    video.addEventListener('loadeddata', onDataReady, { once: true });
    video.addEventListener('loadedmetadata', () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        onDataReady();
      }
    }, { once: true });

    video.onerror = () => {
      finish({
        thumbnailBlob: createPlaceholderVideoThumbnail(fileName, 0),
        duration: 0,
        width: 320,
        height: 240,
      });
    };
  });
}

/**
 * Format video duration (e.g. 65s -> 01:05)
 */
export function formatDuration(seconds?: number): string {
  if (!seconds || !isFinite(seconds) || seconds <= 0) return '00:00';
  const totalSec = Math.round(seconds);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format timestamp (e.g. 2026/09/16)
 */
export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

// ----------------- Lightweight Original Media Resolution -----------------

// In-session registry holding active File objects during current browser runtime
const sessionFileRegistry = new Map<string, File>();

export function registerSessionFile(mediaId: string, file: File) {
  sessionFileRegistry.set(mediaId, file);
}

export function getSessionFile(mediaId: string): File | undefined {
  return sessionFileRegistry.get(mediaId);
}

export function removeSessionFile(mediaId: string) {
  sessionFileRegistry.delete(mediaId);
}

export interface ResolvedMediaSuccess {
  success: true;
  url: string;
  isObjectUrl: boolean;
  fileName: string;
  sourceUrl?: string;
  cleanup?: () => void;
}

export interface ResolvedMediaFailure {
  success: false;
  isMissing: boolean;
  fileName: string;
  error: string; // "missing <fileName>"
  message: string;
}

export type ResolvedMediaResult = ResolvedMediaSuccess | ResolvedMediaFailure;

/**
 * Access original media from original storage location without persistent blob caching in database
 */
export async function resolveOriginalMedia(media: any): Promise<ResolvedMediaResult> {
  if (!media) {
    return {
      success: false,
      isMissing: true,
      fileName: '未知文件',
      error: 'missing 文件',
      message: '未找到媒体记录',
    };
  }

  const fileName = media.fileName || '未知文件';

  // 1. Check in-memory session file
  const sessionFile = sessionFileRegistry.get(media.id);
  if (sessionFile) {
    try {
      const url = URL.createObjectURL(sessionFile);
      return {
        success: true,
        url,
        isObjectUrl: true,
        fileName: media.fileName || sessionFile.name,
        sourceUrl: media.sourceUrl,
        cleanup: () => {
          try { URL.revokeObjectURL(url); } catch {}
        },
      };
    } catch {
      // continue to next resolution
    }
  }

  // 2. Check FileSystemFileHandle (reads directly from user's disk without database cache)
  if (media.fileHandle) {
    try {
      let perm = 'prompt';
      if (typeof media.fileHandle.queryPermission === 'function') {
        perm = await media.fileHandle.queryPermission({ mode: 'read' });
        if (perm !== 'granted' && typeof media.fileHandle.requestPermission === 'function') {
          perm = await media.fileHandle.requestPermission({ mode: 'read' });
        }
      }

      if (perm === 'granted' || typeof media.fileHandle.queryPermission !== 'function') {
        const file = await media.fileHandle.getFile();
        if (file && file.size > 0) {
          const url = URL.createObjectURL(file);
          return {
            success: true,
            url,
            isObjectUrl: true,
            fileName: media.fileName || file.name,
            sourceUrl: media.sourceUrl,
            cleanup: () => {
              try { URL.revokeObjectURL(url); } catch {}
            },
          };
        }
      }
    } catch (err: any) {
      console.warn('Accessing local disk fileHandle failed:', err);
      // File removed, moved, or deleted from disk -> return missing error
      return {
        success: false,
        isMissing: true,
        fileName,
        error: `missing ${fileName}`,
        message: `原存储地址文件已不见或已被移动: ${fileName}`,
      };
    }
  }

  // 3. Check network / remote sourceUrl
  if (media.sourceUrl && typeof media.sourceUrl === 'string') {
    const trimmed = media.sourceUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
      return {
        success: true,
        url: trimmed,
        isObjectUrl: false,
        fileName,
        sourceUrl: trimmed,
      };
    }
  }

  // 4. If blob exists in memory/object/database
  if (media.blob && media.blob instanceof Blob && media.blob.size > 0) {
    const url = URL.createObjectURL(media.blob);
    return {
      success: true,
      url,
      isObjectUrl: true,
      fileName,
      sourceUrl: media.sourceUrl,
      cleanup: () => {
        try { URL.revokeObjectURL(url); } catch {}
      },
    };
  }

  // 5. Fallback: If thumbnailBlob exists in record
  if (media.thumbnailBlob && media.thumbnailBlob instanceof Blob && media.thumbnailBlob.size > 0) {
    const url = URL.createObjectURL(media.thumbnailBlob);
    return {
      success: true,
      url,
      isObjectUrl: true,
      fileName,
      sourceUrl: media.sourceUrl,
      cleanup: () => {
        try { URL.revokeObjectURL(url); } catch {}
      },
    };
  }

  // 5. Original file is missing from storage address
  return {
    success: false,
    isMissing: true,
    fileName,
    error: `missing ${fileName}`,
    message: `原存储地址文件已不见: ${fileName}`,
  };
}

export interface PickedMediaFile {
  file: File;
  handle?: any;
  sourceUrl?: string;
}

/**
 * Pick files using modern File System Access API when supported
 */
export async function pickFilesViaPicker(type: 'image' | 'video'): Promise<PickedMediaFile[]> {
  if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
    try {
      const types =
        type === 'image'
          ? [
              {
                description: '图片文件',
                accept: {
                  'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp'],
                },
              },
            ]
          : [
              {
                description: '视频文件',
                accept: {
                  'video/*': ['.mp4', '.mov', '.webm', '.m4v', '.ogv'],
                },
              },
            ];

      const handles = await (window as any).showOpenFilePicker({
        multiple: true,
        types,
      });

      const results: PickedMediaFile[] = [];
      for (const handle of handles) {
        const file = await handle.getFile();
        results.push({ file, handle, sourceUrl: file.name });
      }
      return results;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return []; // User cancelled
      }
      console.warn('showOpenFilePicker failed, fallback to input', err);
    }
  }
  return [];
}
