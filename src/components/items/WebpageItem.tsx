import React from 'react';
import {
  GripHorizontal,
  Trash2,
  Globe,
  ExternalLink,
  Play,
  RotateCw,
  RotateCcw,
  Maximize2,
  Lock,
  Compass,
} from 'lucide-react';
import { ContentItem } from '../../types';
import { parseWebUrlInfo } from '../../utils/webpage';

interface WebpageItemProps {
  item: ContentItem;
  canvasWidth: number;
  onDragStart: (e: React.PointerEvent, item: ContentItem) => void;
  onRotateStart: (e: React.PointerEvent, item: ContentItem) => void;
  onResizeStart: (e: React.PointerEvent, item: ContentItem) => void;
  onResetTransform: (item: ContentItem) => void;
  onBringToFront?: (id: string) => void;
  onOpenWebpage: (url: string, title?: string) => void;
  onDelete: (id: string) => void;
}

export const WebpageItem: React.FC<WebpageItemProps> = ({
  item,
  canvasWidth,
  onDragStart,
  onRotateStart,
  onResizeStart,
  onResetTransform,
  onBringToFront,
  onOpenWebpage,
  onDelete,
}) => {
  const url = item.sourceUrl || 'https://';
  const parsed = parseWebUrlInfo(url, item.pageTitle || item.fileName);
  const displayTitle = item.pageTitle || item.fileName || parsed.suggestedTitle;
  const isVideoSite = item.isVideoSite ?? parsed.isVideoSite;

  const effectiveWidth = Math.min(Math.max(item.width || 270, 150), canvasWidth - 32);
  const effectiveHeight = Math.max(item.height || 210, 120);

  const handleCardClick = () => {
    onBringToFront?.(item.id);
    onOpenWebpage(url, displayTitle);
  };

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
        className="relative bg-[#FFFFFF] rounded-xl border border-[#E4DCD0] p-2.5 shadow-[var(--scrap-shadow)] hover:shadow-[var(--scrap-hover)] transition-all flex flex-col"
        style={{
          minHeight: `${effectiveHeight}px`,
        }}
      >
        {/* Top washi tape grab handle & action controls */}
        <div className="flex items-center justify-between pb-1.5 border-b border-black/5 mb-1.5">
          <div
            onPointerDown={(e) => onDragStart(e, item)}
            className="flex-1 flex items-center justify-center py-1 cursor-grab active:cursor-grabbing touch-none select-none text-[#94887C] hover:text-[#4A3F35]"
            title="按住拖拽移动网页卡片位置"
          >
            <div className="h-2.5 w-16 rounded-xs bg-[#D6E4EB]/90 border border-black/10 flex items-center justify-center">
              <GripHorizontal className="w-3 h-3 opacity-60 text-[#2D5A7B]" />
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={handleCardClick}
              className="p-1 rounded-md text-[#2D5A7B] hover:text-[#183B54] hover:bg-[#EAF2F8] transition-colors"
              title="在内置窗口中浏览网页/播放视频"
            >
              {isVideoSite ? (
                <Play className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Globe className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="p-1 rounded-md text-[#A85B5B] hover:text-[#C5221F] hover:bg-black/5 transition-colors"
              title="删除此网页书签"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Browser Mockup Visual Card */}
        <div
          onClick={handleCardClick}
          className="relative w-full flex-1 min-h-[110px] bg-[#F7F4EE] hover:bg-[#F2ECE2] rounded-lg border border-[#E2DAD0] overflow-hidden flex flex-col cursor-pointer transition-colors group/card"
        >
          {/* Mockup Titlebar */}
          <div className="bg-[#EFE8DD] border-b border-[#E0D7CB] px-2.5 py-1.5 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#E57373]" />
              <span className="w-2 h-2 rounded-full bg-[#FFD54F]" />
              <span className="w-2 h-2 rounded-full bg-[#81C784]" />
            </div>
            <div className="flex items-center gap-1 text-[10px] text-[#786C5E] font-mono truncate max-w-[150px]">
              <Lock className="w-2.5 h-2.5 shrink-0 opacity-70" />
              <span className="truncate">{parsed.hostname}</span>
            </div>
            <div className="w-3" />
          </div>

          {/* Web Preview Content */}
          <div className="flex-1 p-3 flex flex-col items-center justify-center text-center gap-2 relative">
            {/* Favicon / Web Icon */}
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-white border border-[#DDD3C6] shadow-xs flex items-center justify-center overflow-hidden">
                {parsed.faviconUrl ? (
                  <img
                    src={parsed.faviconUrl}
                    alt={parsed.siteName}
                    className="w-6 h-6 object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <Compass className="w-5 h-5 text-[#4A7291]" />
                )}
              </div>

              {/* Play Badge if Video Site */}
              {isVideoSite && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#E05353] text-white flex items-center justify-center shadow-xs">
                  <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                </div>
              )}
            </div>

            {/* Title & Site Tag */}
            <div className="space-y-0.5 max-w-full px-1">
              <h4 className="text-xs font-semibold text-[#2D2721] line-clamp-2 leading-tight">
                {displayTitle}
              </h4>
              <p className="text-[10px] text-[#8C7D6F] truncate">{parsed.siteName}</p>
            </div>

            {/* Hover Action Badge */}
            <div className="mt-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#4A3F35] text-white text-[10px] font-medium shadow-xs group-hover/card:scale-105 transition-transform">
              {isVideoSite ? (
                <>
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>浏览并播放视频</span>
                </>
              ) : (
                <>
                  <Globe className="w-2.5 h-2.5" />
                  <span>点击浏览网页</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Link Bar */}
        <div className="mt-1.5 pt-1.5 border-t border-black/5 flex items-center justify-between text-[10px] text-[#827466]">
          <span className="truncate max-w-[170px] text-[#7A6E60] font-mono">
            {parsed.hostname}
          </span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 text-[#2D5A7B] hover:text-[#183B54] font-medium transition-colors"
            title="在独立浏览器标签页打开"
          >
            <span>新标签打开</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>

        {/* Bottom-left Corner Rotation Handle */}
        <div
          onPointerDown={(e) => onRotateStart(e, item)}
          className="absolute -bottom-2 -left-2 w-7 h-7 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none z-30 select-none text-[#7D7062] hover:text-[#2D2721] active:scale-110 transition-transform"
          title="触摸或按住旋转网页卡片 (左下角)"
        >
          <div className="w-5 h-5 rounded-bl-lg rounded-tr-sm bg-white border border-[#D9CEBF] shadow-xs flex items-center justify-center">
            <RotateCw className="w-2.5 h-2.5" />
          </div>
        </div>

        {/* Bottom-right Corner Resize Handle */}
        <div
          onPointerDown={(e) => onResizeStart(e, item)}
          className="absolute -bottom-2 -right-2 w-7 h-7 flex items-center justify-center cursor-nwse-resize touch-none z-30 select-none text-[#7D7062] hover:text-[#2D2721] active:scale-110 transition-transform"
          title="触摸或按住拖动以改变卡片大小 (右下角)"
        >
          <div className="w-5 h-5 rounded-br-lg rounded-tl-sm bg-white border border-[#D9CEBF] shadow-xs flex items-center justify-center">
            <Maximize2 className="w-2.5 h-2.5 rotate-90" />
          </div>
        </div>
      </div>
    </div>
  );
};
