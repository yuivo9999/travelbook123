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

export async function processVideoFile(file: File | Blob): Promise<VideoProcessResult> {
  return new Promise((resolve) => {
    const rawBlob = ensureBlob(file, (file as File).type || 'video/mp4') || file;
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(rawBlob);
    } catch {
      resolve({ thumbnailBlob: null, duration: 0, width: 320, height: 240 });
      return;
    }

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata'; // Fast metadata reading
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

    // 1.5s timeout fallback: never keep user waiting long for video adding
    timeoutId = window.setTimeout(() => {
      if (isResolved) return;
      const duration = isFinite(video.duration) ? video.duration : 0;
      const originalWidth = video.videoWidth || 320;
      const originalHeight = video.videoHeight || 240;
      const frameBlob = (originalWidth > 0 && originalHeight > 0)
        ? captureCurrentFrame(originalWidth, originalHeight)
        : null;
      finish({
        thumbnailBlob: frameBlob,
        duration,
        width: originalWidth,
        height: originalHeight,
      });
    }, 1500);

    const onDataReady = () => {
      const duration = isFinite(video.duration) ? video.duration : 0;
      const originalWidth = video.videoWidth || 320;
      const originalHeight = video.videoHeight || 240;

      if (originalWidth <= 0 || originalHeight <= 0) {
        // Wait a tick or fallback
        return;
      }

      // Try seeking to 0.1s for poster
      const seekTime = duration > 1 ? 0.3 : 0.05;

      const handleSeeked = () => {
        const frameBlob = captureCurrentFrame(originalWidth, originalHeight);
        finish({
          thumbnailBlob: frameBlob,
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
          thumbnailBlob: frameBlob,
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
        thumbnailBlob: null,
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
