import React, { useRef, useState } from 'react';
import { Type, Image as ImageIcon, Video as VideoIcon, X, Sparkles } from 'lucide-react';

interface AddContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddText: (text: string, noteColor: 'yellow' | 'white' | 'blue' | 'pink' | 'kraft') => void;
  onSelectImage: (file: File) => void;
  onSelectVideo: (file: File) => void;
}

export const AddContentModal: React.FC<AddContentModalProps> = ({
  isOpen,
  onClose,
  onAddText,
  onSelectImage,
  onSelectVideo,
}) => {
  const [activeTab, setActiveTab] = useState<'menu' | 'text'>('menu');
  const [textContent, setTextContent] = useState('');
  const [selectedColor, setSelectedColor] = useState<'yellow' | 'white' | 'blue' | 'pink' | 'kraft'>('yellow');

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setActiveTab('menu');
    setTextContent('');
    onClose();
  };

  const handleConfirmText = () => {
    if (!textContent.trim()) return;
    onAddText(textContent.trim(), selectedColor);
    handleClose();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectImage(file);
      handleClose();
    }
    // reset input value so re-selecting the same file triggers change
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectVideo(file);
      handleClose();
    }
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const colors: { key: 'yellow' | 'white' | 'blue' | 'pink' | 'kraft'; label: string; bgClass: string }[] = [
    { key: 'yellow', label: '暖黄便签', bgClass: 'bg-[#FFF9E6] border-[#E8DFC2]' },
    { key: 'white', label: '纯白棉纸', bgClass: 'bg-[#FFFFFF] border-[#E5E0D8]' },
    { key: 'kraft', label: '牛皮复古', bgClass: 'bg-[#EBDBC8] border-[#D1BFA8]' },
    { key: 'blue', label: '淡蓝纸条', bgClass: 'bg-[#EBF5FB] border-[#C8DFEE]' },
    { key: 'pink', label: '淡粉笺纸', bgClass: 'bg-[#FDF0F0] border-[#F2D5D5]' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleImageChange}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/mov"
        className="hidden"
        onChange={handleVideoChange}
      />

      <div
        id="add-content-dialog"
        className="w-full sm:max-w-md bg-[#FAF7F2] rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[#E8E2D8] p-5 sm:p-6 animate-in slide-in-from-bottom duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#EFE9DF]">
          <h3 className="text-base font-semibold text-[#2D2721] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#8C7A68]" />
            {activeTab === 'text' ? '添加手账文字纸片' : '贴入手账内容'}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full text-[#8C827A] hover:text-[#2D2721] hover:bg-[#EFE9DF] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {activeTab === 'menu' ? (
          <div className="grid grid-cols-3 gap-3 py-5">
            {/* Add text */}
            <button
              type="button"
              id="btn-add-text"
              onClick={() => setActiveTab('text')}
              className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl bg-[#F4EFE7] hover:bg-[#EFE8DD] border border-[#E3DBD0] text-[#3D342B] transition-all active:scale-95 group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#FFF9E6] border border-[#E6DDCA] shadow-xs flex items-center justify-center text-[#6E5936] group-hover:scale-105 transition-transform">
                <Type className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold">文字纸片</span>
            </button>

            {/* Add image */}
            <button
              type="button"
              id="btn-add-image"
              onClick={() => imageInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl bg-[#F4EFE7] hover:bg-[#EFE8DD] border border-[#E3DBD0] text-[#3D342B] transition-all active:scale-95 group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#FFFFFF] border border-[#E5DFD5] shadow-xs flex items-center justify-center text-[#4B5E4B] group-hover:scale-105 transition-transform">
                <ImageIcon className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold">选择照片</span>
            </button>

            {/* Add video */}
            <button
              type="button"
              id="btn-add-video"
              onClick={() => videoInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl bg-[#F4EFE7] hover:bg-[#EFE8DD] border border-[#E3DBD0] text-[#3D342B] transition-all active:scale-95 group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#FBF5ED] border border-[#E6DACB] shadow-xs flex items-center justify-center text-[#7C4A3A] group-hover:scale-105 transition-transform">
                <VideoIcon className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold">本地视频</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-4">
            {/* Color selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {colors.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setSelectedColor(c.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${c.bgClass} ${
                    selectedColor === c.key
                      ? 'ring-2 ring-[#4A3F35] font-semibold scale-105 shadow-xs'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Textarea */}
            <div
              className={`p-3 rounded-xl border shadow-inner transition-colors ${
                colors.find((c) => c.key === selectedColor)?.bgClass || 'bg-white border-[#DDD5C9]'
              }`}
            >
              <textarea
                id="add-text-textarea"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="在此输入或粘贴旅行攻略、随笔感受、备忘要点..."
                rows={5}
                autoFocus
                className="w-full bg-transparent border-0 focus:outline-hidden text-sm text-[#2D2721] placeholder:text-[#9A9084] resize-none leading-relaxed"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setActiveTab('menu')}
                className="px-4 py-2 text-xs font-medium text-[#5E544A] bg-[#ECE5DC] hover:bg-[#E2D9CE] rounded-xl transition-colors"
              >
                返回选择
              </button>
              <button
                type="button"
                id="btn-confirm-text"
                onClick={handleConfirmText}
                disabled={!textContent.trim()}
                className="px-5 py-2 text-xs font-medium text-white bg-[#4A4036] hover:bg-[#383028] disabled:opacity-40 disabled:pointer-events-none rounded-xl transition-colors shadow-sm"
              >
                贴上手账
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
