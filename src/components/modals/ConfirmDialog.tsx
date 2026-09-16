import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确定删除',
  cancelText = '取消',
  isDanger = true,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        id="confirm-dialog"
        className="w-full max-w-sm bg-[#FAF8F5] rounded-2xl shadow-2xl border border-[#E3DDD4] p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {isDanger && (
              <div className="w-9 h-9 rounded-full bg-[#FCE8E6] flex items-center justify-center text-[#C5221F] shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}
            <h3 className="text-base font-semibold text-[#2D2721]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg text-[#8C827A] hover:text-[#2D2721] hover:bg-[#EFEAE4] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-[#685E55] leading-relaxed pl-1">{message}</p>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            id="confirm-cancel-btn"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[#5E544A] bg-[#ECE5DC] hover:bg-[#E4DCCE] rounded-xl transition-colors active:scale-95"
          >
            {cancelText}
          </button>
          <button
            type="button"
            id="confirm-action-btn"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-xl text-white transition-all active:scale-95 ${
              isDanger
                ? 'bg-[#C5221F] hover:bg-[#A81B18] shadow-sm shadow-[#C5221F]/20'
                : 'bg-[#4A4036] hover:bg-[#383028]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
