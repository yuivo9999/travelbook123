import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Book,
  FileText,
  CheckCircle2,
  Palette,
  Calendar,
  Layers,
} from 'lucide-react';
import { Notebook, CoverType } from '../../types';
import { formatDate } from '../../utils/media';

interface EditCoverModalProps {
  isOpen: boolean;
  notebook: Notebook | null;
  onSave: (coverData: {
    coverType: CoverType;
    coverText?: string;
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
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !notebook) return;
    setCoverType(notebook.coverType === 'text' ? 'text' : 'none');
    setCoverText(notebook.coverText || '');
  }, [isOpen, notebook]);

  if (!isOpen || !notebook) return null;

  const handleConfirmSave = async () => {
    try {
      setIsSaving(true);
      await onSave({
        coverType,
        coverText: coverType === 'text' ? coverText.trim() : undefined,
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

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        id="edit-cover-dialog"
        className="relative w-full max-w-md bg-[#FAF7F2] rounded-2xl sm:rounded-3xl border border-[#E6E0D6] shadow-[0_20px_50px_rgba(45,35,25,0.18)] overflow-hidden flex flex-col max-h-[92vh]"
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
              <p className="text-[11px] text-[#8C7E70] truncate max-w-[250px]">
                《{notebook.title}》封面风格设置
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
          {/* Live Preview */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#6E6152] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#B8860B]" />
              <span>实时效果预览</span>
            </label>

            <div className="bg-[#EFEBE4] p-3 rounded-2xl border border-[#DDD4C7] flex justify-center">
              <div className="w-full max-w-[260px] bg-[#FAF7F2] rounded-2xl border border-[#E3DDD4] p-3.5 shadow-sm flex flex-col gap-2 relative overflow-hidden">
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

                  {coverType === 'none' && (
                    <div className="h-16 rounded-lg bg-[#F2EDE5] border border-dashed border-[#DCD3C5] flex items-center justify-center text-center p-2">
                      <span className="text-[11px] text-[#8C7E70]">
                        无文字 · 极简纯粹手账
                      </span>
                    </div>
                  )}

                  {coverType === 'text' && (
                    <div className="min-h-16 rounded-lg bg-[#FAF5EC] border border-[#E8DFC2] p-2.5 flex flex-col justify-center">
                      <span className="text-[10px] text-[#A39281] font-serif italic mb-0.5">
                        “ 封面寄语 ”
                      </span>
                      <p className="text-xs text-[#4A3F35] leading-relaxed line-clamp-3 font-medium">
                        {coverText.trim() || '（暂未填写文字内容）'}
                      </p>
                    </div>
                  )}

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

          {/* Cover Style Selection Buttons (2 options: 无文字, 有文字) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#4A3F35]">
              选择封面样式（二选一）
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCoverType('none')}
                className={`p-3.5 rounded-xl border text-center transition-all flex flex-col items-center gap-2 ${
                  coverType === 'none'
                    ? 'border-[#524436] bg-white ring-1 ring-[#524436] font-medium text-[#2D241E] shadow-2xs'
                    : 'border-[#DDD4C7] bg-[#FAF7F2] text-[#6E6152] hover:border-[#BDB0A0]'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#EFE9E0] flex items-center justify-center text-[#594E42]">
                  <Book className="w-4 h-4" />
                </div>
                <div className="text-center">
                  <span className="text-xs font-semibold block">无文字</span>
                  <span className="text-[10px] text-[#8C7E70]">极简干净封面</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCoverType('text')}
                className={`p-3.5 rounded-xl border text-center transition-all flex flex-col items-center gap-2 ${
                  coverType === 'text'
                    ? 'border-[#524436] bg-white ring-1 ring-[#524436] font-medium text-[#2D241E] shadow-2xs'
                    : 'border-[#DDD4C7] bg-[#FAF7F2] text-[#6E6152] hover:border-[#BDB0A0]'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#FFF4DC] flex items-center justify-center text-[#996B1A]">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="text-center">
                  <span className="text-xs font-semibold block">有文字</span>
                  <span className="text-[10px] text-[#8C7E70]">自定义副标题/寄语</span>
                </div>
              </button>
            </div>
          </div>

          {/* Text input if coverType === 'text' */}
          {coverType === 'text' && (
            <div className="space-y-2 p-3.5 rounded-xl bg-white border border-[#DDD4C7] animate-in fade-in">
              <label className="block text-xs font-semibold text-[#4A3F35]">
                输入封面文字内容 / 副标题 / 寄语
              </label>
              <textarea
                value={coverText}
                onChange={(e) => setCoverText(e.target.value)}
                placeholder="例如：2024金秋苏州漫游行记；备选方案与灵感收集..."
                rows={3}
                maxLength={200}
                className="w-full p-2.5 rounded-lg border border-[#DDD3C6] text-xs sm:text-sm text-[#2D241E] focus:outline-hidden focus:ring-1 focus:ring-[#524436] placeholder:text-[#A89E92]"
              />
              <div className="flex items-center justify-between text-[11px] text-[#8C7E70]">
                <span>支持简短说明或手账寄语</span>
                <span>{coverText.length}/200</span>
              </div>
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
