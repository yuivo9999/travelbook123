import React from 'react';
import { Bell, BellOff, Clock3 } from 'lucide-react';
import { AppSettings } from '../../types';

interface NotificationSettingsProps {
  settings: AppSettings;
  onUpdate: (settings: AppSettings) => void;
}

const DURATIONS = [
  { value: 1000, label: '1 秒' },
  { value: 2000, label: '2 秒（默认）' },
  { value: 4000, label: '4 秒' },
  { value: 6000, label: '6 秒' },
  { value: 0, label: '一直显示' },
];

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({ settings, onUpdate }) => {
  return (
    <div className="fixed inset-x-4 bottom-4 z-[10001] sm:left-auto sm:right-6 sm:w-[360px] rounded-2xl border border-[#DCCFBE] bg-[#FAF7F2] shadow-2xl p-4 text-[#382F26]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 font-serif font-bold text-sm">
            {settings.showActionNotifications ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            消息通知
          </div>
          <p className="text-[11px] text-[#8C7E70] mt-1">控制保存、删除、导入、导出等操作提示。</p>
        </div>
        <button type="button" role="switch" aria-checked={settings.showActionNotifications} onClick={() => onUpdate({ ...settings, showActionNotifications: !settings.showActionNotifications })} className={`relative w-11 h-6 rounded-full transition-colors ${settings.showActionNotifications ? 'bg-[#4A3F35]' : 'bg-[#C9C0B5]'}`}>
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.showActionNotifications ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
      <div className="border-t border-[#EAE3D6] pt-3">
        <div className="flex items-center gap-2 text-xs font-semibold mb-2"><Clock3 className="w-3.5 h-3.5" />显示多久</div>
        <div className="grid grid-cols-2 gap-2">
          {DURATIONS.map((duration) => (
            <button key={duration.value} type="button" disabled={!settings.showActionNotifications} onClick={() => onUpdate({ ...settings, notificationDuration: duration.value })} className={`rounded-lg border px-3 py-2 text-xs transition-colors ${settings.notificationDuration === duration.value ? 'border-[#4A3F35] bg-[#EFE8DF] font-semibold' : 'border-[#E2D9CC] bg-white/70 hover:border-[#BFB2A2]'} ${!settings.showActionNotifications ? 'opacity-45 cursor-not-allowed' : ''}`}>
              {duration.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
