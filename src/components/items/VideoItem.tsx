import React, { useState, useEffect } from 'react';
import { GripHorizontal, Trash2, Play, Film } from 'lucide-react';
import { ContentItem } from '../../types';
import { getMedia } from '../../db/indexedDB';
import { formatDuration, createSafeBlobUrl } from '../../utils/media';

interface VideoItemProps {
  item: ContentItem;
  canvasWidth: number;
  onDragStart: (e: React.PointerEvent, item: ContentItem) => void;
  onPlayVideo: (mediaId?: string) => void;
  onDelete: (id: string, mediaId?: string) => void;
}

export const VideoItem: React.FC<VideoItemProps> = ({
  item,
  canvasWidth,
  onDragStart,
  onPlayVideo,
  onDelete,
}) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activeThumbUrl: string | null = null;
    let activeVideoUrl: string | null = null;
    let isMounted = true;

    async function loadMediaData() {
      if (!item.mediaId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const media = await getMedia(item.mediaId);
        if (media && isMounted) {
          if (media.duration) setDuration(media.duration);

          // 1. Try thumbnail image
          if (media.thumbnailBlob) {
            activeThumbUrl = createSafeBlobUrl(media.thumbnailBlob, 'image/jpeg');
            setThumbUrl(activeThumbUrl);
          }

          // 2. Prepare video stream url for preview or playback fallback
          if (media.blob) {
            activeVideoUrl = createSafeBlobUrl(media.blob, media.mimeType || 'video/mp4');
            setVideoBlobUrl(activeVideoUrl);
          }
        }
      } catch (e) {
        console.error('加载视频信息失败', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadMediaData();

    return () => {
      isMounted = false;
      if (activeThumbUrl && activeThumbUrl.startsWith('blob:')) {
        URL.revokeObjectURL(activeThumbUrl);
      }
      if (activeVideoUrl && activeVideoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(activeVideoUrl);
      }
    };
  }, [item.mediaId]);

  const effectiveWidth = Math.min(item.width || 260, canvasWidth - 32);

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
              onClick={() => onPlayVideo(item.mediaId)}
              className="p-1 rounded-md text-[#7D7062] hover:text-[#2D2721] hover:bg-black/5 transition-colors"
              title="播放视频"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(item.id, item.mediaId)}
              className="p-1 rounded-md text-[#A85B5B] hover:text-[#C5221F] hover:bg-black/5 transition-colors"
              title="删除此视频"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Video thumbnail with static frame or video preview & play badge */}
        <div
          onClick={() => onPlayVideo(item.mediaId)}
          className="relative w-full aspect-16/10 bg-[#231E1A] rounded-lg overflow-hidden flex items-center justify-center cursor-pointer group/vid"
        >
          {loading ? (
            <div className="flex flex-col items-center gap-1 text-[#A09386]">
              <Film className="w-6 h-6 animate-pulse" />
              <span className="text-[10px]">读取视频...</span>
            </div>
          ) : thumbUrl ? (
            <img
              src={thumbUrl}
              alt="视频缩略图"
              loading="lazy"
              className="w-full h-full object-cover select-none transition-transform duration-300 group-hover/vid:scale-102 brightness-95"
            />
          ) : videoBlobUrl ? (
            /* Direct HTML5 Video Frame if thumbnail is not extracted */
            <video
              src={`${videoBlobUrl}#t=0.1`}
              preload="metadata"
              muted
              playsInline
              className="w-full h-full object-cover pointer-events-none brightness-95"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5 text-[#C9BDB0]">
              <Film className="w-7 h-7 opacity-70" />
              <span className="text-[11px] font-medium tracking-wide">本地视频</span>
            </div>
          )}

          {/* Centered Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/vid:bg-black/35 transition-colors">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/90 text-[#2D2721] flex items-center justify-center shadow-lg transform group-hover/vid:scale-110 transition-transform pl-0.5">
              <Play className="w-5 h-5 fill-current" />
            </div>
          </div>

          {/* Duration badge */}
          {duration !== undefined && duration > 0 && (
            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium tracking-wider backdrop-blur-xs">
              {formatDuration(duration)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
