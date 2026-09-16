import React, { useRef, useState } from 'react';
import { Type, Image as ImageIcon, Video as VideoIcon, X, Sparkles, Link2, Globe, FileCode } from 'lucide-react';
import { pickFilesViaPicker } from '../../utils/media';

interface AddContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddText: (text: string, noteColor: 'yellow' | 'white' | 'blue' | 'pink' | 'kraft') => void;
  onSelectImage: (file: File, fileHandle?: any) => void;
  onSelectVideo: (file: File, fileHandle?: any) => void;
  onAddUrlMedia?: (url: string, type: 'image' | 'video', customName?: string) => void;
}

export const AddContentModal: React.FC<AddContentModalProps> = ({
  isOpen,
  onClose,
  onAddText,
  onSelectImage,
  onSelectVideo,
  onAddUrlMedia,
}) => {
  const [activeTab, setActiveTab] = useState<'menu' | 'text' | 'url'>('menu');
  const [textContent, setTextContent] = useState('');
  const [selectedColor, setSelectedColor] = useState<'yellow' | 'white' | 'blue' | 'pink' | 'kraft'>('yellow');
  const [urlInput, setUrlInput] = useState('');
  const [urlType, setUrlType] = useState<'image' | 'video'>('image');
  const [urlName, setUrlName] = useState('');

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setActiveTab('menu');
    setTextContent('');
    setUrlInput('');
    setUrlName('');
    onClose();
  };

  const handleConfirmText = () => {
    if (!textContent.trim()) return;
    onAddText(textContent.trim(), selectedColor);
    handleClose();
  };

  const handlePickImages = async () => {
    try {
      const picked = await pickFilesViaPicker('image');
      if (picked.length > 0) {
        picked.forEach((p) => onSelectImage(p.file, p.handle));
        handleClose();
        return;
      }
    } catch {
      // fallback
    }
    imageInputRef.current?.click();
  };

  const handlePickVideos = async () => {
    try {
      const picked = await pickFilesViaPicker('video');
      if (picked.length > 0) {
        picked.forEach((p) => onSelectVideo(p.file, p.handle));
        handleClose();
        return;
      }
    } catch {
      // fallback
    }
    videoInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      files.forEach((file) => onSelectImage(file));
      handleClose();
    }
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      files.forEach((file) => onSelectVideo(file));
      handleClose();
    }
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleConfirmUrl = () => {
    if (!urlInput.trim()) return;
    if (onAddUrlMedia) {
      onAddUrlMedia(urlInput.trim(), urlType, urlName.trim() || undefined);
    }
    handleClose();
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
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Hidden fallback file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        multiple
        accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.heic,.bmp,.svg"
        className="hidden"
        onChange={handleImageChange}
      />
      <input
        ref={videoInputRef}
        type="file"
        multiple
        accept="video/*,.mp4,.mov,.webm,.m4v,.ogv,.avi,.mkv"
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
            {activeTab === 'text'
              ? '添加手账文字纸片'
              : activeTab === 'url'
              ? '添加网络或原地址媒体'
              : '贴入手账内容 (轻量化存储)'}
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
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-4">
              {/* Add text */}
              <button
                type="button"
                id="btn-add-text"
                onClick={() => setActiveTab('text')}
                className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl bg-[#F4EFE7] hover:bg-[#EFE8DD] border border-[#E3DBD0] text-[#3D342B] transition-all active:scale-95 group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#FFF9E6] border border-[#E6DDCA] shadow-xs flex items-center justify-center text-[#6E5936] group-hover:scale-105 transition-transform">
                  <Type className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold">文字纸片</span>
              </button>

              {/* Add image */}
              <button
                type="button"
                id="btn-add-image"
                onClick={handlePickImages}
                className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl bg-[#F4EFE7] hover:bg-[#EFE8DD] border border-[#E3DBD0] text-[#3D342B] transition-all active:scale-95 group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#FFFFFF] border border-[#E5DFD5] shadow-xs flex items-center justify-center text-[#4B5E4B] group-hover:scale-105 transition-transform">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold">选择照片</span>
              </button>

              {/* Add video */}
              <button
                type="button"
                id="btn-add-video"
                onClick={handlePickVideos}
                className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl bg-[#F4EFE7] hover:bg-[#EFE8DD] border border-[#E3DBD0] text-[#3D342B] transition-all active:scale-95 group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#FBF5ED] border border-[#E6DACB] shadow-xs flex items-center justify-center text-[#7C4A3A] group-hover:scale-105 transition-transform">
                  <VideoIcon className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold">本地视频</span>
              </button>

              {/* Add URL / Link address */}
              <button
                type="button"
                id="btn-add-url-media"
                onClick={() => setActiveTab('url')}
                className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl bg-[#F4EFE7] hover:bg-[#EFE8DD] border border-[#E3DBD0] text-[#3D342B] transition-all active:scale-95 group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#EDF4F9] border border-[#D0DFEB] shadow-xs flex items-center justify-center text-[#2F5E82] group-hover:scale-105 transition-transform">
                  <Globe className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold">原地址链接</span>
              </button>
            </div>

            {/* Lightweight Note */}
            <div className="rounded-xl bg-[#F0EAE1]/70 border border-[#E4DCcf] p-3 text-[11px] text-[#6E6356] leading-relaxed flex flex-col gap-1">
              <span className="font-semibold text-[#4A3F35] flex items-center gap-1.5">
                ⚡ 轻量化存储说明：
              </span>
              <p>• 本项目采用<b>仅保存缩略图</b>机制，不占用浏览器大量数据库存储。</p>
              <p>• 点击大图或视频时将直接访问原存储地址；若原文件丢失或移动将显示 <span className="font-mono text-[#C2410C] font-semibold">missing+文件名</span> 提示。</p>
            </div>
          </div>
        ) : activeTab === 'text' ? (
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
        ) : (
          <div className="flex flex-col gap-3 py-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUrlType('image')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  urlType === 'image'
                    ? 'bg-[#4A4036] text-white border-[#4A4036]'
                    : 'bg-[#EFE8DD] text-[#5A4E42] border-[#E0D7CB]'
                }`}
              >
                图片地址 (URL)
              </button>
              <button
                type="button"
                onClick={() => setUrlType('video')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  urlType === 'video'
                    ? 'bg-[#4A4036] text-white border-[#4A4036]'
                    : 'bg-[#EFE8DD] text-[#5A4E42] border-[#E0D7CB]'
                }`}
              >
                视频地址 (URL)
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#73685C] mb-1">原文件网络地址或本地服务路径：</label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://... 或 http://localhost:8080/..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-[#DCD3C7] text-[#2D2721] focus:outline-hidden focus:ring-2 focus:ring-[#8C7A68]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#73685C] mb-1">文件名称 (选填)：</label>
              <input
                type="text"
                value={urlName}
                onChange={(e) => setUrlName(e.target.value)}
                placeholder={urlType === 'image' ? 'photo.jpg' : 'video.mp4'}
                className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-[#DCD3C7] text-[#2D2721] focus:outline-hidden focus:ring-2 focus:ring-[#8C7A68]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('menu')}
                className="px-4 py-2 text-xs font-medium text-[#5E544A] bg-[#ECE5DC] hover:bg-[#E2D9CE] rounded-xl transition-colors"
              >
                返回选择
              </button>
              <button
                type="button"
                id="btn-confirm-url"
                onClick={handleConfirmUrl}
                disabled={!urlInput.trim()}
                className="px-5 py-2 text-xs font-medium text-white bg-[#4A4036] hover:bg-[#383028] disabled:opacity-40 disabled:pointer-events-none rounded-xl transition-colors shadow-sm"
              >
                贴入手账
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
