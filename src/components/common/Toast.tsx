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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] flex flex-col gap-2 w-[90%] max-w-md pointer-events-none">
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
    }, 3800);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isError = toast.type === 'error';

  return (
    <div
      id={`toast-${toast.id}`}
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
        isError
          ? 'bg-[#FDF2F2] border-[#F8D7DA] text-[#842029]'
          : 'bg-[#F3F8F2] border-[#D1E7DD] text-[#0F5132]'
      }`}
    >
      {isError ? (
        <AlertCircle className="w-4 h-4 shrink-0 text-[#DC3545]" />
      ) : (
        <CheckCircle2 className="w-4 h-4 shrink-0 text-[#198754]" />
      )}
      <span className="flex-1 font-medium">{toast.text}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="p-1 rounded-md opacity-60 hover:opacity-100 transition-opacity"
        aria-label="关闭提示"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
