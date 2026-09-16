import React, { useState, useEffect } from 'react';
import { GripHorizontal, Trash2, Maximize2, Image as ImageIcon } from 'lucide-react';
import { ContentItem } from '../../types';
import { getMedia } from '../../db/indexedDB';

interface ImageItemProps {
  item: ContentItem;
  canvasWidth: number;
  onDragStart: (e: React.PointerEvent, item: ContentItem) => void;
  onViewImage: (mediaId?: string) => void;
  onDelete: (id: string, mediaId?: string) => void;
}

export const ImageItem: React.FC<ImageItemProps> = ({
  item,
  canvasWidth,
  onDragStart,
  onViewImage,
  onDelete,
}) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activeUrl: string | null = null;
    let isMounted = true;

    async function loadThumb() {
      if (!item.mediaId) {
        setLoading(false);
        return;
      }
      try {
        const media = await getMedia(item.mediaId);
        if (media && isMounted) {
          const blobToUse = media.thumbnailBlob || media.blob;
          activeUrl = URL.createObjectURL(blobToUse);
          setThumbUrl(activeUrl);
        }
      } catch (e) {
        console.error('加载图片缩略图失败', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadThumb();

    return () => {
      isMounted = false;
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [item.mediaId]);

  const effectiveWidth = Math.min(item.width || 240, canvasWidth - 32);

  return (
    <div
      id={`item-${item.id}`}
      style={{
        transform: `translate3d(${item.x}px, ${item.y}px, 0px) rotate(${item.rotation || 0}deg)`,
        width: `${effectiveWidth}px`,
        zIndex: item.zIndex,
      }}
      className="absolute top-0 left-0 transition-shadow duration-150 group touch-auto select-none"
    >
      <div className="relative bg-[#FFFFFF] rounded-xl border border-[#E6E0D6] p-2.5 shadow-[var(--scrap-shadow)] hover:shadow-[var(--scrap-hover)] transition-all">
        {/* Top washi tape grab handle */}
        <div className="flex items-center justify-between pb-1.5 border-b border-black/5 mb-1.5">
          <div
            onPointerDown={(e) => onDragStart(e, item)}
            className="flex-1 flex items-center justify-center py-1 cursor-grab active:cursor-grabbing touch-none select-none text-[#94887C] hover:text-[#4A3F35]"
            title="按住拖拽移动位置"
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
          className="relative w-full aspect-4/3 bg-[#F5F2ED] rounded-lg overflow-hidden flex items-center justify-center cursor-zoom-in group/img"
        >
          {loading ? (
            <div className="flex flex-col items-center gap-1 text-[#A09386]">
              <ImageIcon className="w-6 h-6 animate-pulse" />
              <span className="text-[10px]">读取图片...</span>
            </div>
          ) : thumbUrl ? (
            <>
              <img
                src={thumbUrl}
                alt="手账照片"
                loading="lazy"
                className="w-full h-full object-cover select-none transition-transform duration-300 group-hover/img:scale-102"
              />
              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                <div className="bg-black/50 text-white p-1.5 rounded-full backdrop-blur-xs">
                  <Maximize2 className="w-4 h-4" />
                </div>
              </div>
            </>
          ) : (
            <div className="text-xs text-[#9E9082]">暂无图片数据</div>
          )}
        </div>
      </div>
    </div>
  );
};
