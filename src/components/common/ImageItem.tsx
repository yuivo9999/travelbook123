import React, { useState, useEffect } from 'react';
import {
  GripHorizontal,
  Trash2,
  Maximize2,
  Image as ImageIcon,
  Link2,
  RotateCw,
  RotateCcw,
} from 'lucide-react';
import { ContentItem } from '../../types';
import { getMedia } from '../../db/indexedDB';
import { createSafeBlobUrl, getOriginalMediaBlob } from '../../utils/media';

// In-memory cache for media URLs so items don't flicker or get revoked during re-renders/dragging
const mediaUrlCache = new Map<string, string>();

interface ImageItemProps {
  item: ContentItem;
  canvasWidth: number;
  onDragStart: (e: React.PointerEvent, item: ContentItem) => void;
  onRotateStart: (e: React.PointerEvent, item: ContentItem) => void;
  onResizeStart: (e: React.PointerEvent, item: ContentItem) => void;
  onResetTransform: (item: ContentItem) => void;
  onBringToFront?: (id: string) => void;
  onViewImage: (mediaId?: string) => void;
  onDelete: (id: string, mediaId?: string) => void;
}

export const ImageItem: React.FC<ImageItemProps> = ({
  item,
  canvasWidth,
  onDragStart,
  onRotateStart,
  onResizeStart,
  onResetTransform,
  onBringToFront,
  onViewImage,
  onDelete,
}) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [fileMeta, setFileMeta] = useState<{ fileName?: string; sourceUrl?: string }>({
    fileName: item.fileName,
    sourceUrl: item.sourceUrl,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadThumb() {
      if (!item.mediaId) {
        setLoading(false);
        return;
      }

      // Check cache first for instant rendering
      const cached = mediaUrlCache.get(item.mediaId);
      if (cached) {
        setThumbUrl(cached);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setHasError(false);
        const media = await getMedia(item.mediaId);
        if (media && isMounted) {
          setFileMeta({
            fileName: media.fileName || item.fileName,
            sourceUrl: media.sourceUrl || item.sourceUrl,
          });
          const blobToUse = media.thumbnailBlob;
          const url = createSafeBlobUrl(blobToUse, media.mimeType || 'image/jpeg');
          if (url) {
            mediaUrlCache.set(item.mediaId, url);
            setThumbUrl(url);
          } else {
            setHasError(true);
          }
        } else if (!media && isMounted) {
          setHasError(true);
        }
      } catch (e) {
        console.error('加载图片缩略图失败', e);
        if (isMounted) setHasError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadThumb();

    return () => {
      isMounted = false;
    };
  }, [item.mediaId, item.fileName, item.sourceUrl]);

  const handleImageError = async () => {
    if (!item.mediaId) return;
    try {
      const media = await getMedia(item.mediaId);
      const original = await getOriginalMediaBlob(media);
      if (original) {
        const fullUrl = createSafeBlobUrl(original, media?.mimeType || 'image/jpeg');
        if (fullUrl && fullUrl !== thumbUrl) {
          setThumbUrl(fullUrl);
          return;
        }
      }
    } catch {
      // ignore
    }
    setHasError(true);
  };

  const effectiveWidth = Math.min(Math.max(item.width || 240, 120), canvasWidth - 32);
  const effectiveHeight = Math.max(item.height || 200, 110);

  return (
    <div
      id={`item-${item.id}`}
      style={{
        transform: `translate3d(${item.x}px, ${item.y}px, 0px) rotate(${item.rotation || 0}deg)`,
        width: `${effectiveWidth}px`,
        zIndex: item.zIndex,
      }}
      onPointerDownCapture={() => {
        onBringToFront?.(item.id);
      }}
      className="absolute top-0 left-0 transition-shadow duration-150 group touch-auto select-none"
    >
      <div
        className="relative bg-[#FFFFFF] rounded-xl border border-[#E6E0D6] p-2.5 shadow-[var(--scrap-shadow)] hover:shadow-[var(--scrap-hover)] transition-all flex flex-col"
        style={{
          minHeight: `${effectiveHeight}px`,
        }}
      >
        {/* Top washi tape grab handle */}
        <div className="flex items-center justify-between pb-1.5 border-b border-black/5 mb-1.5">
          <div
            onPointerDown={(e) => onDragStart(e, item)}
            className="flex-1 flex items-center justify-center py-1 cursor-grab active:cursor-grabbing touch-none select-none text-[#94887C] hover:text-[#4A3F35]"
            title="按住拖拽移动照片位置"
          >
            <div className="h-2.5 w-16 rounded-xs bg-[#E5D7C3]/90 border border-black/10 flex items-center justify-center">
              <GripHorizontal className="w-3 h-3 opacity-60" />
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onViewImage(item.mediaId)}
              className="p-1 rounded-md text-[#7D7062] hover:text-[#2D2721] hover:bg-black/5 transition-colors"
              title="查看大图"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onResetTransform(item)}
              className="p-1 rounded-md text-[#7D7062] hover:text-[#2D2721] hover:bg-black/5 transition-colors"
              title="恢复默认大小与角度"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(item.id, item.mediaId)}
              className="p-1 rounded-md text-[#A85B5B] hover:text-[#C5221F] hover:bg-black/5 transition-colors"
              title="删除此图片"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Thumbnail area with Polaroid photo look */}
        <div
          onClick={() => onViewImage(item.mediaId)}
          className="relative w-full flex-1 min-h-[100px] bg-[#F5F2ED] rounded-lg overflow-hidden flex items-center justify-center cursor-zoom-in group/img"
        >
          {loading ? (
            <div className="flex flex-col items-center gap-1 text-[#A09386]">
              <ImageIcon className="w-6 h-6 animate-pulse" />
              <span className="text-[10px]">读取图片...</span>
            </div>
          ) : thumbUrl && !hasError ? (
            <>
              <img
                src={thumbUrl}
                alt="手账照片"
                loading="lazy"
                onError={handleImageError}
                className="w-full h-full object-cover select-none transition-transform duration-300 group-hover/img:scale-102"
              />
              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                <div className="bg-black/50 text-white p-1.5 rounded-full backdrop-blur-xs">
                  <Maximize2 className="w-4 h-4" />
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 text-[#9E9082] p-4 text-center">
              <ImageIcon className="w-6 h-6 opacity-60" />
              <span className="text-xs">暂无图片数据</span>
            </div>
          )}
        </div>

        {/* Polaroid bottom caption / Original file link */}
        {(fileMeta.fileName || fileMeta.sourceUrl) && (
          <div className="mt-1.5 pt-1.5 border-t border-black/5 flex items-center justify-between text-[10px] text-[#827466]">
            <a
              href={fileMeta.sourceUrl?.startsWith('http') ? fileMeta.sourceUrl : undefined}
              target={fileMeta.sourceUrl?.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
              onClick={(e) => {
                if (!fileMeta.sourceUrl?.startsWith('http')) {
                  e.preventDefault();
                  navigator.clipboard?.writeText(fileMeta.sourceUrl || fileMeta.fileName || '');
                }
              }}
              className="flex items-center gap-1 max-w-full truncate hover:text-[#4A3F35] transition-colors"
              title={`原文件地址: ${fileMeta.sourceUrl || fileMeta.fileName || ''} (点击复制或打开)`}
            >
              <Link2 className="w-3 h-3 shrink-0 opacity-70" />
              <span className="truncate">{fileMeta.fileName || fileMeta.sourceUrl}</span>
            </a>
          </div>
        )}

        {/* Bottom-left Corner Rotation Handle (Touch-friendly & Desktop) */}
        <div
          onPointerDown={(e) => onRotateStart(e, item)}
          className="absolute -bottom-2 -left-2 w-7 h-7 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none z-30 select-none text-[#7D7062] hover:text-[#2D2721] active:scale-110 transition-transform"
          title="触摸或按住旋转照片 (左下角，支持机械齿轮音效与灵敏度调节)"
        >
          <div className="w-5 h-5 rounded-bl-lg rounded-tr-sm bg-white border border-[#D9CEBF] shadow-xs flex items-center justify-center">
            <RotateCw className="w-2.5 h-2.5" />
          </div>
        </div>

        {/* Bottom-right Corner Resize Handle (Touch-friendly & Desktop) */}
        <div
          onPointerDown={(e) => onResizeStart(e, item)}
          className="absolute -bottom-2 -right-2 w-7 h-7 flex items-center justify-center cursor-nwse-resize touch-none z-30 select-none text-[#7D7062] hover:text-[#2D2721] active:scale-110 transition-transform"
          title="触摸或按住拖动以改变照片大小 (右下角)"
        >
          <div className="w-5 h-5 rounded-br-lg rounded-tl-sm bg-white border border-[#D9CEBF] shadow-xs flex items-center justify-center">
            <Maximize2 className="w-2.5 h-2.5 rotate-90" />
          </div>
        </div>
      </div>
    </div>
  );
};
