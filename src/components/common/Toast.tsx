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

  // Operation feedback is intentionally a single-slot notification. Batch
  // actions can generate dozens of messages (for example, adding 50 photos),
  // so stacking every message would cover the screen and keep old messages
  // alive long after they are useful. The newest result replaces the previous
  // one while the normal user-configured lifetime still applies.
  const latestToast = toasts.length > 0 ? toasts[toasts.length - 1] : null;

  return (
    <div className="fixed bottom-4 right-4 z-[20000] w-[min(calc(100vw-2rem),360px)] pointer-events-none">
      <AnimatePresence mode="wait">
        {latestToast && (
          <ToastItem
            key={latestToast.id}
            toast={latestToast}
            duration={settings.notificationDuration}
            onDismiss={() => onDismiss(latestToast.id)}
          />
        )}
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
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.16 } }}
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${bgColor} ${textColor} max-w-full`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="min-w-0 flex-1 text-sm font-medium break-words">{toast.text}</span>
      <button onClick={onDismiss} className="ml-2 shrink-0 hover:opacity-70 transition-opacity" aria-label="关闭通知">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
