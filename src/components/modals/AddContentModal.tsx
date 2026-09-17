import React, { useRef, useState } from 'react';
import { Type, Image as ImageIcon, Video as VideoIcon, X, Sparkles, Link2, Globe, FileCode, CheckCircle2 } from 'lucide-react';
import { pickFilesViaPicker } from '../../utils/media';
import { isDirectImageUrl, isDirectVideoUrl, extractUrlAndTitleFromText } from '../../utils/webpage';

interface AddContentModalProps {
  isOpen: boolean;
  initialTab?: 'menu' | 'text' | 'url';
  onClose: () => void;
  onAddText: (text: string, noteColor: 'yellow' | 'white' | 'blue' | 'pink' | 'kraft') => void;
  onSelectImage: (file: File) => void;
  onSelectVideo: (file: File) => void;
  onAddUrlMedia?: (url: string, type: 'image' | 'video', customName?: string) => void;
  onAddWebpage?: (url: string, title?: string) => void;
  onPickImages?: () => void;
  onPickVideos?: () => void;
}

export const AddContentModal: React.FC<AddContentModalProps> = ({
  isOpen,
  initialTab = 'menu',
  onClose,
  onAddText,
  onSelectImage,
  onSelectVideo,
  onAddUrlMedia,
  onAddWebpage,
  onPickImages,
  onPickVideos,
}) => {
  const [activeTab, setActiveTab] = useState<'menu' | 'text' | 'url'>(initialTab);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
  const [textContent, setTextContent] = useState('');
  const [selectedColor, setSelectedColor] = useState<'yellow' | 'white' | 'blue' | 'pink' | 'kraft'>('yellow');
  const [urlInput, setUrlInput] = useState('');
  const [urlType, setUrlType] = useState<'webpage' | 'image' | 'video'>('webpage');
  const [urlName, setUrlName] = useState('');
  const [extractedNotice, setExtractedNotice] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setActiveTab('menu');
    setTextContent('');
    setUrlInput('');
    setUrlName('');
    setExtractedNotice(null);
    onClose();
  };

  const handleUrlInputChange = (val: string) => {
    const extracted = extractUrlAndTitleFromText(val);
    if (extracted.isExtracted && extracted.url) {
      setUrlInput(extracted.url);
      if (extracted.extractedTitle && !urlName.trim()) {
        setUrlName(extracted.extractedTitle);
      }
      setExtractedNotice(`已自动为您智能解析提取链接：${extracted.url}`);
    } else {
      setUrlInput(val);
      setExtractedNotice(null);
    }
  };

  const handleConfirmText = () => {
    if (!textContent.trim()) return;
    onAddText(textContent.trim(), selectedColor);
    handleClose();
  };

  const handlePickImages = () => {
    if (onPickImages) {
      onPickImages();
    } else {
      imageInputRef.current?.click();
    }
  };

  const handlePickVideos = () => {
    if (onPickVideos) {
      onPickVideos();
    } else {
      videoInputRef.current?.click();
    }
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
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    const isImage = isDirectImageUrl(trimmed);
    const isVideo = isDirectVideoUrl(trimmed);

    if (urlType === 'image' || (urlType === 'webpage' && isImage)) {
      if (onAddUrlMedia) {
        onAddUrlMedia(trimmed, 'image', urlName.trim() || undefined);
      }
    } else if (urlType === 'video' || (urlType === 'webpage' && isVideo)) {
      if (onAddUrlMedia) {
        onAddUrlMedia(trimmed, 'video', urlName.trim() || undefined);
      }
    } else if (urlType === 'webpage') {
      if (onAddWebpage) {
        onAddWebpage(trimmed, urlName.trim() || undefined);
      } else if (onAddUrlMedia) {
        onAddUrlMedia(trimmed, 'video', urlName.trim() || undefined);
      }
    } else if (onAddUrlMedia) {
      onAddUrlMedia(trimmed, urlType, urlName.trim() || undefined);
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
        accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.avif,.bmp,.svg,.ico,.tiff,.heic"
        className="hidden"
        onChange={handleImageChange}
      />
      <input
        ref={videoInputRef}
        type="file"
        multiple
        accept="video/*,.mp4,.mov,.webm,.m3u8,.m4v,.ogv,.avi,.mkv,.ts"
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
              : '添加手账内容'}
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
            {/* Link Type Selector */}
            <div className="flex items-center gap-1.5 p-1 bg-[#EFE8DD] rounded-xl">
              <button
                type="button"
                onClick={() => setUrlType('webpage')}
                className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  urlType === 'webpage'
                    ? 'bg-[#4A4036] text-white shadow-xs'
                    : 'text-[#5A4E42] hover:bg-[#E5DDCF]'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>网页网址</span>
              </button>
              <button
                type="button"
                onClick={() => setUrlType('image')}
                className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  urlType === 'image'
                    ? 'bg-[#4A4036] text-white shadow-xs'
                    : 'text-[#5A4E42] hover:bg-[#E5DDCF]'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>直链图片</span>
              </button>
              <button
                type="button"
                onClick={() => setUrlType('video')}
                className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  urlType === 'video'
                    ? 'bg-[#4A4036] text-white shadow-xs'
                    : 'text-[#5A4E42] hover:bg-[#E5DDCF]'
                }`}
              >
                <VideoIcon className="w-3.5 h-3.5" />
                <span>直链视频</span>
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#73685C] mb-1">
                {urlType === 'webpage'
                  ? '网页地址 / 抖音口令 / 视频网站链接：'
                  : urlType === 'image'
                  ? '图片直链 (支持 PNG/JPG/WebP/AVIF/SVG/GIF/DataURI 等)：'
                  : '视频直链 (支持 MP4/m3u8/WebM/MOV/M4V/OGV 等)：'}
              </label>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => handleUrlInputChange(e.target.value)}
                placeholder={
                  urlType === 'webpage'
                    ? '粘贴完整网页链接或抖音分享口令文字（例如：https://v.douyin.com/... 或 https://...）'
                    : urlType === 'image'
                    ? 'https://.../photo.webp 或 https://.../image.png'
                    : 'https://.../stream.m3u8 或 https://.../video.mp4'
                }
                autoFocus
                className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-[#DCD3C7] text-[#2D2721] focus:outline-hidden focus:ring-2 focus:ring-[#8C7A68]"
              />
            </div>

            {extractedNotice && (
              <div className="p-2 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] text-[11px] text-[#166534] flex items-center gap-1.5 animate-fadeIn">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                <span className="truncate">{extractedNotice}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-[#73685C] mb-1">
                {urlType === 'webpage' ? '网页标题 (选填，留空自动提取)：' : '文件名称 (选填)：'}
              </label>
              <input
                type="text"
                value={urlName}
                onChange={(e) => setUrlName(e.target.value)}
                placeholder={
                  urlType === 'webpage'
                    ? '例如：旅行记录视频 / 攻略文章'
                    : urlType === 'image'
                    ? 'photo.jpg'
                    : 'video.m3u8'
                }
                className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-[#DCD3C7] text-[#2D2721] focus:outline-hidden focus:ring-2 focus:ring-[#8C7A68]"
              />
            </div>

            {/* Feature Tip */}
            {urlType === 'webpage' && (
              <div className="p-2.5 rounded-xl bg-[#EDF4F9] border border-[#D0DFEB] text-[11px] text-[#2F5E82] leading-relaxed flex items-start gap-1.5">
                <Globe className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  贴入后将生成网页书签卡片。点击即可在手账内置窗口中<b>浏览网页</b>及<b>播放网页视频</b>，还支持自由缩放、旋转与拖拽摆放。
                </span>
              </div>
            )}
            {urlType === 'video' && (
              <div className="p-2.5 rounded-xl bg-[#F6F3ED] border border-[#E2DAD0] text-[11px] text-[#635547] leading-relaxed flex items-start gap-1.5">
                <VideoIcon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#8C7A68]" />
                <span>
                  已支持 <b>m3u8 HLS 流媒体</b>、MP4、WebM、MOV 等常见网络视频格式，支持内置流媒体渲染与全屏观看。
                </span>
              </div>
            )}
            {urlType === 'image' && (
              <div className="p-2.5 rounded-xl bg-[#F6F3ED] border border-[#E2DAD0] text-[11px] text-[#635547] leading-relaxed flex items-start gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#8C7A68]" />
                <span>
                  已支持 <b>WebP、AVIF、SVG、GIF 动态图、BMP、ICO、TIFF、JPEG、PNG 及 Base64 Data URI</b> 等所有常见网页图片。
                </span>
              </div>
            )}

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
