import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'error' | 'success' | 'info';
  text: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center gap-1.5 w-auto max-w-[280px] pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 3200);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isError = toast.type === 'error';

  return (
    <div
      id={`toast-${toast.id}`}
      className={`pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-md border text-[11px] font-medium transition-all duration-200 animate-in fade-in slide-in-from-bottom-1 max-w-full ${
        isError
          ? 'bg-[#FDF2F2] border-[#F8D7DA] text-[#842029]'
          : 'bg-[#F3F8F2] border-[#D1E7DD] text-[#0F5132]'
      }`}
    >
      {isError ? (
        <AlertCircle className="w-3 h-3 shrink-0 text-[#DC3545]" />
      ) : (
        <CheckCircle2 className="w-3 h-3 shrink-0 text-[#198754]" />
      )}
      <span className="truncate max-w-[200px]">{toast.text}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="p-0.5 -mr-0.5 rounded-full opacity-60 hover:opacity-100 transition-opacity"
        aria-label="关闭提示"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
};
