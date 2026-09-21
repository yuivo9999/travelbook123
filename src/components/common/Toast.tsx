import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { loadSettings } from '../../utils/settings';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  const settings = loadSettings();
  if (!settings.showActionNotifications) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[20000] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} duration={settings.notificationDuration} onDismiss={() => onDismiss(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, duration, onDismiss }: { toast: ToastMessage; duration: number; onDismiss: () => void }) {
  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  const Icon = toast.type === 'success' ? CheckCircle : toast.type === 'error' ? AlertCircle : Info;
  const bgColor = toast.type === 'success' ? 'bg-green-100' : toast.type === 'error' ? 'bg-red-100' : 'bg-blue-100';
  const textColor = toast.type === 'success' ? 'text-green-800' : toast.type === 'error' ? 'text-red-800' : 'text-blue-800';

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.3 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
      className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${bgColor} ${textColor}`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-sm font-medium">{toast.text}</span>
      <button onClick={onDismiss} className="ml-2 hover:opacity-70 transition-opacity" aria-label="关闭通知">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
