import React, { useState, useRef, useEffect } from 'react';
import {
  GripHorizontal,
  Edit3,
  Trash2,
  Check,
  X,
  RotateCw,
  RotateCcw,
  Maximize2,
} from 'lucide-react';
import { ContentItem } from '../../types';

interface TextItemProps {
  item: ContentItem;
  canvasWidth: number;
  onDragStart: (e: React.PointerEvent, item: ContentItem) => void;
  onRotateStart: (e: React.PointerEvent, item: ContentItem) => void;
  onResizeStart: (e: React.PointerEvent, item: ContentItem) => void;
  onResetTransform: (item: ContentItem) => void;
  onBringToFront?: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onToggleHalfWidth?: (item: ContentItem) => void;
}

export const TextItem: React.FC<TextItemProps> = ({
  item,
  canvasWidth,
  onDragStart,
  onRotateStart,
  onResizeStart,
  onResetTransform,
  onBringToFront,
  onUpdateText,
  onDelete,
  onToggleHalfWidth,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(item.text || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraftText(item.text || '');
  }, [item.text]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (draftText.trim() !== (item.text || '').trim()) {
      onUpdateText(item.id, draftText.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraftText(item.text || '');
    setIsEditing(false);
  };

  const colorStyles = {
    yellow: 'bg-[#FFFBEB] border-[#F1E5C4] text-[#3D3325]',
    white: 'bg-[#FFFFFF] border-[#E8E2D8] text-[#2D2721]',
    blue: 'bg-[#F0F7FB] border-[#D0E2EE] text-[#253846]',
    pink: 'bg-[#FDF2F2] border-[#F4DADA] text-[#4A2B2B]',
    kraft: 'bg-[#EDE1D1] border-[#D6C5B0] text-[#3E3223]',
  }[item.noteColor || 'yellow'];

  // Clamp width according to canvas (supports min-width down to 44px = two Chinese characters)
  const effectiveWidth = Math.min(Math.max(item.width || 260, 44), canvasWidth - 32);
  const effectiveHeight = item.height || 160;
  const isNarrow = effectiveWidth < 90;
  const isUltraNarrow = effectiveWidth < 60;

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
        className={`relative rounded-xl border p-2 pt-1.5 shadow-[var(--scrap-shadow)] hover:shadow-[var(--scrap-hover)] transition-all flex flex-col ${colorStyles}`}
        style={{
          minHeight: `${effectiveHeight}px`,
        }}
      >
        {/* Washi Tape / Grab Handle at the top - 2-line layout when narrow */}
        <div className={`pb-1 mb-1 border-b border-black/5 ${isNarrow ? 'flex flex-col items-center gap-0.5' : 'flex items-center justify-between gap-0.5'}`}>
          <div
            onPointerDown={(e) => onDragStart(e, item)}
            className="w-full flex items-center justify-center py-0.5 cursor-grab active:cursor-grabbing touch-none select-none text-[#94887C] hover:text-[#4A3F35]"
            title="按住拖拽移动便签位置"
          >
            {/* Vintage washi tape indicator */}
            <div className={`h-2 rounded-xs bg-[#E5D7C3]/90 border border-black/10 flex items-center justify-center ${isUltraNarrow ? 'w-5' : isNarrow ? 'w-8' : 'w-14'}`}>
              <GripHorizontal className="w-3 h-3 opacity-60" />
            </div>
          </div>

          <div className={`flex items-center justify-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity ${isNarrow ? 'w-full' : ''}`}>
            {!isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="p-0.5 rounded-md text-[#7D7062] hover:text-[#2D2721] hover:bg-black/5 transition-colors"
                  title="编辑文字"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  className="p-0.5 rounded-md text-[#A85B5B] hover:text-[#C5221F] hover:bg-black/5 transition-colors"
                  title="删除此便签"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSave}
                  className="p-0.5 rounded-md text-[#198754] hover:bg-black/5 transition-colors"
                  title="完成编辑"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="p-0.5 rounded-md text-[#6C757D] hover:bg-black/5 transition-colors"
                  title="取消"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content body - auto-adapts typography and flow to dynamic note dimensions */}
        {isEditing ? (
          <div className="pt-1 flex-1 flex flex-col min-h-[90px]">
            <textarea
              ref={textareaRef}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onBlur={handleSave}
              className="w-full flex-1 min-h-[80px] bg-transparent border-0 focus:outline-hidden text-sm leading-relaxed resize-none select-text font-normal"
              placeholder="输入文字..."
            />
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSave();
                }}
                className="px-2.5 py-1 text-xs font-medium text-white bg-[#4A4036] rounded-md active:scale-95 transition-transform"
              >
                保存
              </button>
            </div>
          </div>
        ) : (
          <div
            onDoubleClick={() => setIsEditing(true)}
            className="text-sm leading-relaxed whitespace-pre-wrap break-words break-all py-1 select-text font-normal cursor-text flex-1 flex flex-col justify-start"
          >
            {item.text || '（空白便签，双击输入文字）'}
          </div>
        )}

        {/* Bottom-left Corner Rotation Handle (Touch-friendly & Desktop) */}
        <div
          onPointerDown={(e) => onRotateStart(e, item)}
          className="absolute -bottom-2 -left-2 w-7 h-7 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none z-30 select-none text-[#7D7062] hover:text-[#2D2721] active:scale-110 transition-transform"
          title="触摸或按住旋转便签 (左下角，支持机械齿轮音效与灵敏度调节)"
        >
          <div className="w-5 h-5 rounded-bl-lg rounded-tr-sm bg-white border border-[#D9CEBF] shadow-xs flex items-center justify-center">
            <RotateCw className="w-2.5 h-2.5" />
          </div>
        </div>

        {/* Bottom-right Corner Resize Handle (Touch-friendly & Desktop) */}
        <div
          onPointerDown={(e) => onResizeStart(e, item)}
          className="absolute -bottom-2 -right-2 w-7 h-7 flex items-center justify-center cursor-nwse-resize touch-none z-30 select-none text-[#7D7062] hover:text-[#2D2721] active:scale-110 transition-transform"
          title="触摸或按住拖动以改变便签大小 (右下角，文字自适应排列)"
        >
          <div className="w-5 h-5 rounded-br-lg rounded-tl-sm bg-white border border-[#D9CEBF] shadow-xs flex items-center justify-center">
            <Maximize2 className="w-2.5 h-2.5 rotate-90" />
          </div>
        </div>
      </div>
    </div>
  );
};

