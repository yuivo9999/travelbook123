/**
 * Media processing utilities for digital scrapbook:
 * - Image thumbnail generation
 * - Video thumbnail generation via HTML5 video + canvas
 * - Blob URL caching and memory management
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

export async function processImageFile(file: File | Blob, maxWidth = 640): Promise<ImageProcessResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

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
        // Fallback to original blob
        resolve({ thumbnailBlob: file, width: originalWidth, height: originalHeight });
        return;
      }

      // High quality smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ thumbnailBlob: blob, width: originalWidth, height: originalHeight });
          } else {
            resolve({ thumbnailBlob: file, width: originalWidth, height: originalHeight });
          }
        },
        'image/webp',
        0.88
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('无法解析该图片文件，格式可能不被支持'));
    };

    img.src = objectUrl;
  });
}

export async function processVideoFile(file: File | Blob): Promise<VideoProcessResult> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);

    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = objectUrl;

    let timeoutId: number;

    const cleanup = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute('src');
      video.load();
    };

    // Timeout safety: if video fails to seek or render within 5s, resolve gracefully without crash
    timeoutId = window.setTimeout(() => {
      cleanup();
      resolve({
        thumbnailBlob: null,
        duration: 0,
        width: 320,
        height: 240,
      });
    }, 5000);

    video.onloadedmetadata = () => {
      const duration = isFinite(video.duration) ? video.duration : 0;
      const originalWidth = video.videoWidth || 320;
      const originalHeight = video.videoHeight || 240;

      // Seek to 0.5s or duration/4 to capture an informative frame
      const seekTime = duration > 1 ? 0.5 : Math.max(0.1, duration / 2);

      video.currentTime = seekTime;

      video.onseeked = () => {
        try {
          const maxWidth = 540;
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
          if (ctx) {
            ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
            canvas.toBlob(
              (blob) => {
                cleanup();
                resolve({
                  thumbnailBlob: blob,
                  duration,
                  width: originalWidth,
                  height: originalHeight,
                });
              },
              'image/jpeg',
              0.85
            );
            return;
          }
        } catch {
          // Canvas cross-origin or decode exception
        }

        cleanup();
        resolve({
          thumbnailBlob: null,
          duration,
          width: originalWidth,
          height: originalHeight,
        });
      };
    };

    video.onerror = () => {
      cleanup();
      resolve({
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
