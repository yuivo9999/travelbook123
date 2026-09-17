import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Book,
  FileText,
  Image as ImageIcon,
  Upload,
  Check,
  CheckCircle2,
  Trash2,
  Palette,
  Calendar,
  Layers,
} from 'lucide-react';
import { Notebook, CoverType } from '../../types';
import { getItemsByNotebook, getMedia } from '../../db/store';
import { createSafeBlobUrl, formatDate } from '../../utils/media';

interface EditCoverModalProps {
  isOpen: boolean;
  notebook: Notebook | null;
  onSave: (coverData: {
    coverType: CoverType;
    coverText?: string;
    coverImageData?: string;
    coverImageId?: string;
  }) => Promise<void> | void;
  onClose: () => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const EditCoverModal: React.FC<EditCoverModalProps> = ({
  isOpen,
  notebook,
  onSave,
  onClose,
  showToast,
}) => {
  const [coverType, setCoverType] = useState<CoverType>('none');
  const [coverText, setCoverText] = useState('');
  const [customImageData, setCustomImageData] = useState<string | undefined>(undefined);
  const [selectedImageId, setSelectedImageId] = useState<string | undefined>(undefined);
  const [existingImages, setExistingImages] = useState<
    { id: string; mediaId: string; thumbUrl: string }[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || !notebook) return;

    setCoverType(notebook.coverType || (notebook.coverImageData || notebook.coverImageId ? 'image' : notebook.coverText ? 'text' : 'none'));
    setCoverText(notebook.coverText || '');
    setCustomImageData(notebook.coverImageData);
    setSelectedImageId(notebook.coverImageId);

    // Load available images inside notebook for quick selection
    async function loadNotebookMedia() {
      try {
        const items = await getItemsByNotebook(notebook!.id);
        const imageItems = items.filter((it) => it.type === 'image' && it.mediaId);
        const mediaList: { id: string; mediaId: string; thumbUrl: string }[] = [];

        for (const it of imageItems) {
          if (!it.mediaId) continue;
          try {
            const media = await getMedia(it.mediaId);
            if (media) {
              const blob = media.thumbnailBlob || media.blob;
              const url = createSafeBlobUrl(blob, media.mimeType || 'image/jpeg');
              if (url) {
                mediaList.push({ id: it.id, mediaId: it.mediaId, thumbUrl: url });
              }
            }
          } catch {
            // ignore
          }
        }
        setExistingImages(mediaList);
      } catch (e) {
        console.warn('Failed to load notebook images for cover selector', e);
      }
    }

    loadNotebookMedia();
  }, [isOpen, notebook]);

  if (!isOpen || !notebook) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件（JPG、PNG、WebP等）', 'error');
      return;
    }

    // Read and compress as Data URI
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        // Create an image element to downscale large files if needed
        const img = new Image();
        img.onload = () => {
          const maxDim = 800;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            setCustomImageData(compressed);
            setSelectedImageId(undefined);
            setCoverType('image');
            showToast('已加载自选封面图片', 'success');
          } else {
            setCustomImageData(result);
            setSelectedImageId(undefined);
            setCoverType('image');
          }
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleConfirmSave = async () => {
    try {
      setIsSaving(true);
      await onSave({
        coverType,
        coverText: coverType === 'text' ? coverText.trim() : undefined,
        coverImageData: coverType === 'image' ? customImageData : undefined,
        coverImageId: coverType === 'image' ? selectedImageId : undefined,
      });
      showToast('手账本封面已更新', 'success');
      onClose();
    } catch (e) {
      console.error(e);
      showToast('更新封面失败', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Compute live preview image source
  let previewImageSrc: string | undefined = undefined;
  if (coverType === 'image') {
    if (customImageData) {
      previewImageSrc = customImageData;
    } else if (selectedImageId) {
      const match = existingImages.find((img) => img.mediaId === selectedImageId);
      previewImageSrc = match?.thumbUrl;
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.gif"
        className="hidden"
        onChange={handleFileUpload}
      />

      <div
        id="edit-cover-dialog"
        className="relative w-full max-w-lg bg-[#FAF7F2] rounded-2xl sm:rounded-3xl border border-[#E6E0D6] shadow-[0_20px_50px_rgba(45,35,25,0.18)] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-[#EAE3D6] flex items-center justify-between bg-[#F4EFEA]/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E8DFD3] border border-[#D9CFC1] flex items-center justify-center text-[#524436]">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-[#2D241E]">
                自定义手账封面
              </h3>
              <p className="text-[11px] text-[#8C7E70] truncate max-w-[280px]">
                《{notebook.title}》封面外观定制
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8C7E70] hover:text-[#382F26] hover:bg-[#EAE3D6] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-[#382F26]">
          {/* Live Preview of the Notebook Card */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#6E6152] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#B8860B]" />
              <span>实时效果预览</span>
            </label>

            <div className="bg-[#EFEBE4] p-3 rounded-2xl border border-[#DDD4C7] flex justify-center">
              <div className="w-full max-w-[280px] bg-[#FAF7F2] rounded-2xl border border-[#E3DDD4] p-3.5 shadow-sm flex flex-col gap-2 relative overflow-hidden">
                {/* Book spine decorative accent */}
                <div className="absolute left-0 top-0 bottom-0 w-2 bg-[#8C7A68]/40 border-r border-[#8C7A68]/20" />

                <div className="pl-1.5 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#EFE9E0] text-[#594E42] flex items-center justify-center shrink-0 border border-[#E0D7CC]">
                      <Book className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-sm font-semibold text-[#2D2721] truncate">
                      {notebook.title}
                    </h4>
                  </div>

                  {/* Mode-specific preview content */}
                  {coverType === 'none' && (
                    <div className="h-16 rounded-lg bg-[#F2EDE5] border border-dashed border-[#DCD3C5] flex items-center justify-center text-center p-2">
                      <span className="text-[11px] text-[#8C7E70]">
                        无封面图片 · 极简纯粹手账
                      </span>
                    </div>
                  )}

                  {coverType === 'text' && (
                    <div className="min-h-16 rounded-lg bg-[#FAF5EC] border border-[#E8DFC2] p-2.5 flex flex-col justify-center">
                      <span className="text-[10px] text-[#A39281] font-serif italic mb-0.5">
                        “ 封面寄语 / 简介 ”
                      </span>
                      <p className="text-xs text-[#4A3F35] leading-relaxed line-clamp-3 font-medium">
                        {coverText.trim() || '（暂未填写文字内容）'}
                      </p>
                    </div>
                  )}

                  {coverType === 'image' && (
                    <div className="h-28 rounded-lg overflow-hidden border border-[#E8E2D8] bg-[#EFEBE4] relative">
                      {previewImageSrc ? (
                        <img
                          src={previewImageSrc}
                          alt="封面预览"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-[#9E9082] p-2 text-center">
                          <ImageIcon className="w-6 h-6 opacity-60 mb-1" />
                          <span className="text-[11px]">请在下方上传或自选照片</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Meta stats */}
                  <div className="flex items-center justify-between text-[10px] text-[#7A6F64] pt-0.5">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 opacity-70" />
                      <span>{formatDate(Date.now())}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Layers className="w-3 h-3 opacity-70" />
                      <span>{notebook.itemCount ?? 0} 条资料</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cover Style Selection Buttons */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#4A3F35]">
              选择封面展示模式
            </label>

            <div className="grid grid-cols-3 gap-2">
              {/* Mode 1: None */}
              <button
                type="button"
                onClick={() => setCoverType('none')}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  coverType === 'none'
                    ? 'border-[#524436] bg-white ring-1 ring-[#524436] font-medium text-[#2D241E] shadow-2xs'
                    : 'border-[#DDD4C7] bg-[#FAF7F2] text-[#6E6152] hover:border-[#BDB0A0]'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-[#EFE9E0] flex items-center justify-center text-[#594E42]">
                  <Book className="w-4 h-4" />
                </div>
                <span className="text-xs">无封面图片</span>
              </button>

              {/* Mode 2: Text */}
              <button
                type="button"
                onClick={() => setCoverType('text')}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  coverType === 'text'
                    ? 'border-[#524436] bg-white ring-1 ring-[#524436] font-medium text-[#2D241E] shadow-2xs'
                    : 'border-[#DDD4C7] bg-[#FAF7F2] text-[#6E6152] hover:border-[#BDB0A0]'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-[#FFF4DC] flex items-center justify-center text-[#996B1A]">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-xs">文字内容显示</span>
              </button>

              {/* Mode 3: Image */}
              <button
                type="button"
                onClick={() => setCoverType('image')}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  coverType === 'image'
                    ? 'border-[#524436] bg-white ring-1 ring-[#524436] font-medium text-[#2D241E] shadow-2xs'
                    : 'border-[#DDD4C7] bg-[#FAF7F2] text-[#6E6152] hover:border-[#BDB0A0]'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-[#E5ECE7] flex items-center justify-center text-[#3D6346]">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <span className="text-xs">用户自选图片</span>
              </button>
            </div>
          </div>

          {/* Details Config Based on Selected Mode */}
          {coverType === 'text' && (
            <div className="space-y-2 p-3.5 rounded-xl bg-white border border-[#DDD4C7] animate-in fade-in">
              <label className="block text-xs font-semibold text-[#4A3F35]">
                输入封面文字内容 / 副标题 / 寄语
              </label>
              <textarea
                value={coverText}
                onChange={(e) => setCoverText(e.target.value)}
                placeholder="例如：2024金秋苏州漫游行记；买电脑配置研究与备选方案；好友聚会温馨留念..."
                rows={3}
                maxLength={200}
                className="w-full p-2.5 rounded-lg border border-[#DDD3C6] text-xs sm:text-sm text-[#2D241E] focus:outline-hidden focus:ring-1 focus:ring-[#524436] placeholder:text-[#A89E92]"
              />
              <div className="flex items-center justify-between text-[11px] text-[#8C7E70]">
                <span>支持简短说明或旅行寄语</span>
                <span>{coverText.length}/200</span>
              </div>
            </div>
          )}

          {coverType === 'image' && (
            <div className="space-y-3 p-3.5 rounded-xl bg-white border border-[#DDD4C7] animate-in fade-in">
              {/* Option A: Upload local image */}
              <div>
                <label className="block text-xs font-semibold text-[#4A3F35] mb-1.5">
                  自选并上传本地照片作为封面
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#B8AA99] bg-[#FAF7F2] hover:bg-[#F2ECE1] text-xs font-medium text-[#4A3F35] flex items-center justify-center gap-2 transition-colors active:scale-98"
                >
                  <Upload className="w-4 h-4 text-[#7D6F61]" />
                  <span>{customImageData ? '重新选择 / 更换本地照片' : '点击选择本地图片上传'}</span>
                </button>
              </div>

              {/* Option B: Choose from existing photos in notebook */}
              {existingImages.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-[#4A3F35] mb-1.5">
                    或者：从手账现有照片中快速指定
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-36 overflow-y-auto p-1 bg-[#F4EFEA] rounded-xl border border-[#E3D9CC]">
                    {existingImages.map((img) => {
                      const isSelected =
                        !customImageData && selectedImageId === img.mediaId;
                      return (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => {
                            setSelectedImageId(img.mediaId);
                            setCustomImageData(undefined);
                          }}
                          className={`relative aspect-square rounded-lg overflow-hidden border transition-all ${
                            isSelected
                              ? 'border-[#4A3F35] ring-2 ring-[#4A3F35]'
                              : 'border-[#DDD4C7] opacity-75 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={img.thumbUrl}
                            alt="候选图片"
                            className="w-full h-full object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-black/25 flex items-center justify-center text-white">
                              <Check className="w-4 h-4 stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {(customImageData || selectedImageId) && (
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomImageData(undefined);
                      setSelectedImageId(undefined);
                    }}
                    className="text-[11px] text-[#A85B5B] hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>清除当前封面图片</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-[#EAE3D6] flex items-center justify-end gap-2 bg-[#F4EFEA]/80">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[#6E6152] hover:bg-[#EAE3D6] transition-colors"
          >
            取消
          </button>

          <button
            type="button"
            id="btn-confirm-save-cover"
            onClick={handleConfirmSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4A3F35] hover:bg-[#382F26] text-white text-xs font-medium shadow-xs transition-all active:scale-95 disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isSaving ? '保存中...' : '完成设置'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
