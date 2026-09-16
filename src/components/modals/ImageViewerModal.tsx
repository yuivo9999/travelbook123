import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { getMedia } from '../../db/indexedDB';

interface ImageViewerModalProps {
  isOpen: boolean;
  mediaId?: string;
  fallbackUrl?: string;
  altText?: string;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  mediaId,
  fallbackUrl,
  altText = '手账图片',
  onClose,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setImageUrl(null);
      return;
    }

    let activeUrl: string | null = null;
    let isMounted = true;

    async function loadImage() {
      setLoading(true);
      setError(null);

      try {
        if (mediaId) {
          const media = await getMedia(mediaId);
          if (media && isMounted) {
            activeUrl = URL.createObjectURL(media.blob);
            setImageUrl(activeUrl);
            setLoading(false);
            return;
          }
        }

        if (fallbackUrl && isMounted) {
          setImageUrl(fallbackUrl);
          setLoading(false);
          return;
        }

        throw new Error('未找到原始图片数据');
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : '加载图片失败');
          setLoading(false);
        }
      }
    }

    loadImage();

    return () => {
      isMounted = false;
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [isOpen, mediaId, fallbackUrl]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id="image-viewer-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Top right close button */}
      <button
        type="button"
        id="image-viewer-close-btn"
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm transition-all active:scale-90"
        aria-label="关闭图片预览"
      >
        <X className="w-6 h-6 stroke-[2.5]" />
      </button>

      <div
        className="relative max-w-full max-h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()} // Prevent clicking image from closing
      >
        {loading && (
          <div className="flex flex-col items-center gap-3 text-white/80 py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm font-medium tracking-wider">正在加载清晰原图...</span>
          </div>
        )}

        {error && (
          <div className="bg-[#2A2420] text-[#E0D8D0] p-6 rounded-2xl border border-white/10 max-w-sm text-center">
            <p className="text-sm">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs text-white"
            >
              返回手账
            </button>
          </div>
        )}

        {imageUrl && !loading && !error && (
          <img
            id="fullsize-preview-image"
            src={imageUrl}
            alt={altText}
            className="max-w-[95vw] max-h-[88vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200 select-none"
          />
        )}
      </div>
    </div>
  );
};
