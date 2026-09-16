import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Palette,
  HardDrive,
  Info,
  Download,
  Upload,
  Trash2,
  Check,
  Sparkles,
  ShieldCheck,
  FileText,
  Layers,
  LayoutGrid,
} from 'lucide-react';
import { AppSettings, BackgroundSkin, PaperStyle } from '../../types';
import {
  BACKGROUND_SKINS,
  PAPER_PATTERNS,
  getStorageQuotaInfo,
  exportAllDataToJSON,
  importDataFromJSON,
} from '../../utils/settings';
import { getDatabaseStats, clearAllDatabaseData } from '../../db/indexedDB';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onClose: () => void;
  onDataReset: () => void;
  onDataImported: () => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

type TabType = 'visual' | 'storage' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onUpdateSettings,
  onClose,
  onDataReset,
  onDataImported,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('visual');
  const [storageInfo, setStorageInfo] = useState<{
    usageText: string;
    quotaText: string;
    percentage: number;
  }>({ usageText: '计算中...', quotaText: '', percentage: 0 });
  const [dbStats, setDbStats] = useState<{
    notebookCount: number;
    itemCount: number;
    mediaCount: number;
  }>({ notebookCount: 0, itemCount: 0, mediaCount: 0 });
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load stats when opened or tab changed to storage
  useEffect(() => {
    if (!isOpen) return;

    async function loadStats() {
      try {
        const quota = await getStorageQuotaInfo();
        setStorageInfo(quota);
        const stats = await getDatabaseStats();
        setDbStats(stats);
      } catch (e) {
        console.error('Failed to load storage stats', e);
      }
    }

    loadStats();
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleSkinSelect = (skinId: BackgroundSkin) => {
    onUpdateSettings({ ...settings, backgroundSkin: skinId });
    showToast('已应用背景皮肤', 'success');
  };

  const handlePatternSelect = (patternId: PaperStyle) => {
    onUpdateSettings({ ...settings, defaultPaperPattern: patternId });
    showToast('已更新默认纸张样式', 'success');
  };

  const handleCornerSelect = (corner: 'rounded' | 'sharp' | 'stamp') => {
    onUpdateSettings({ ...settings, paperCornerStyle: corner });
    showToast('已更新纸张边缘样式', 'success');
  };

  const handleToggleSnap = () => {
    const nextVal = !settings.snapToGrid;
    onUpdateSettings({ ...settings, snapToGrid: nextVal });
    showToast(nextVal ? '已开启对齐网格吸附' : '已关闭网格吸附', 'info');
  };

  // Export JSON
  const handleExport = async () => {
    try {
      setIsExporting(true);
      await exportAllDataToJSON();
      showToast('手账备份文件已导出至下载目录', 'success');
    } catch (e) {
      console.error(e);
      showToast('导出备份失败', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Import JSON trigger
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const result = await importDataFromJSON(file);
      showToast(`成功恢复 ${result.notebookCount} 本手账，共 ${result.itemCount} 项内容`, 'success');
      onDataImported();
      onClose();
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : '导入失败，请检查文件格式', 'error');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Reset all
  const handleConfirmReset = async () => {
    try {
      await clearAllDatabaseData();
      showToast('已清空全部本地手账数据', 'info');
      setIsResetConfirmOpen(false);
      onDataReset();
      onClose();
    } catch (e) {
      console.error(e);
      showToast('清空数据失败', 'error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Hidden file input for restore */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      <div
        className="relative w-full max-w-2xl bg-[#FAF7F2] rounded-2xl sm:rounded-3xl border border-[#E6E0D6] shadow-[0_20px_50px_rgba(45,35,25,0.18)] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with warm aesthetic stamp */}
        <div className="px-5 sm:px-7 py-4 border-b border-[#EAE3D6] flex items-center justify-between bg-[#F4EFEA]/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E8DFD3] border border-[#D9CFC1] flex items-center justify-center text-[#524436]">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-[#382F26]">手账设置</h3>
              <p className="text-[11px] text-[#8C7E70]">视觉定制 · 本地存储 · 离线隐私</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8C7E70] hover:text-[#382F26] hover:bg-black/5 transition-colors"
            title="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-5 sm:px-7 pt-2.5 border-b border-[#EAE3D6] gap-2 bg-[#FAF7F2]">
          <button
            type="button"
            onClick={() => setActiveTab('visual')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium border-b-2 transition-all ${
              activeTab === 'visual'
                ? 'border-[#4A3F35] text-[#382F26] font-bold'
                : 'border-transparent text-[#8C7E70] hover:text-[#382F26]'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>视觉与皮肤</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('storage')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium border-b-2 transition-all ${
              activeTab === 'storage'
                ? 'border-[#4A3F35] text-[#382F26] font-bold'
                : 'border-transparent text-[#8C7E70] hover:text-[#382F26]'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>数据与备份</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium border-b-2 transition-all ${
              activeTab === 'about'
                ? 'border-[#4A3F35] text-[#382F26] font-bold'
                : 'border-transparent text-[#8C7E70] hover:text-[#382F26]'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>关于与说明</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: VISUAL & SKINS */}
          {activeTab === 'visual' && (
            <div className="space-y-6">
              {/* Section 1: Background Skin */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-serif font-bold text-sm text-[#382F26] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#8C7A6B]" />
                    <span>全局背景皮肤</span>
                  </h4>
                  <span className="text-[11px] text-[#9E9082]">点击即时预览</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {BACKGROUND_SKINS.map((skin) => {
                    const isSelected = settings.backgroundSkin === skin.id;
                    return (
                      <button
                        key={skin.id}
                        type="button"
                        onClick={() => handleSkinSelect(skin.id)}
                        className={`p-3 rounded-xl border text-left transition-all relative flex flex-col gap-1.5 ${
                          isSelected
                            ? 'border-[#4A3F35] shadow-xs ring-1 ring-[#4A3F35]'
                            : 'border-[#E6DFD3] hover:border-[#C4B9A9] bg-[#FFFFFF]/70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className="w-5 h-5 rounded-full border border-black/15 shadow-xs"
                            style={{ backgroundColor: skin.previewColor }}
                          />
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-[#4A3F35] text-[#FAF7F2] flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-xs text-[#382F26]">{skin.name}</div>
                          <div className="text-[10px] text-[#8C7E70] leading-tight mt-0.5">{skin.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Default Paper Pattern */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-serif font-bold text-sm text-[#382F26] flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#8C7A6B]" />
                    <span>默认手账纸张样式</span>
                  </h4>
                  <span className="text-[11px] text-[#9E9082]">每本手账内亦可单独切换</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {PAPER_PATTERNS.map((pattern) => {
                    const isSelected = settings.defaultPaperPattern === pattern.id;
                    return (
                      <button
                        key={pattern.id}
                        type="button"
                        onClick={() => handlePatternSelect(pattern.id)}
                        className={`p-3 rounded-xl border text-left transition-all relative flex flex-col gap-2 ${
                          isSelected
                            ? 'border-[#4A3F35] shadow-xs ring-1 ring-[#4A3F35]'
                            : 'border-[#E6DFD3] hover:border-[#C4B9A9] bg-[#FFFFFF]/70'
                        }`}
                      >
                        {/* Miniature pattern preview */}
                        <div
                          className={`w-full h-10 rounded-lg border border-black/10 overflow-hidden ${pattern.cssClass} flex items-center justify-center`}
                        >
                          <span className="text-[9px] text-[#8C7E70] bg-[#FAF7F2]/85 px-1 rounded">
                            {pattern.name}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-[#382F26]">{pattern.name}</span>
                          {isSelected && (
                            <span className="w-3.5 h-3.5 rounded-full bg-[#4A3F35] text-[#FAF7F2] flex items-center justify-center">
                              <Check className="w-2 h-2 stroke-[3]" />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Paper Edge & Layout Options */}
              <div className="pt-2 border-t border-[#EAE3D6] space-y-4">
                <h4 className="font-serif font-bold text-sm text-[#382F26] flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#8C7A6B]" />
                  <span>排版与纸张形态</span>
                </h4>

                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'rounded', label: '圆角手账', desc: '柔和复古' },
                    { id: 'sharp', label: '简约信纸', desc: '干练平整' },
                    { id: 'stamp', label: '邮票复古边', desc: '双层立体' },
                  ].map((corner) => {
                    const isSelected = settings.paperCornerStyle === corner.id;
                    return (
                      <button
                        key={corner.id}
                        type="button"
                        onClick={() => handleCornerSelect(corner.id as any)}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'border-[#4A3F35] bg-[#FFFFFF] shadow-xs ring-1 ring-[#4A3F35]'
                            : 'border-[#E6DFD3] hover:border-[#C4B9A9] bg-[#FAF7F2]'
                        }`}
                      >
                        <div className="text-xs font-medium text-[#382F26]">{corner.label}</div>
                        <div className="text-[10px] text-[#8C7E70]">{corner.desc}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Snap to grid switch */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#F4EFEA]/80 border border-[#E6DFD3]">
                  <div>
                    <div className="text-xs font-medium text-[#382F26]">拖拽吸附辅助线</div>
                    <div className="text-[11px] text-[#8C7E70]">摆放照片和便签时以 10px 网格微吸附对齐</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleSnap}
                    className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                      settings.snapToGrid ? 'bg-[#4A3F35]' : 'bg-[#D9CFC1]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                        settings.snapToGrid ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STORAGE & DATA */}
          {activeTab === 'storage' && (
            <div className="space-y-6">
              {/* Storage Quota Card */}
              <div className="p-4 rounded-2xl bg-[#F4EFEA] border border-[#E5DFD4] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#382F26]">
                    <HardDrive className="w-4 h-4 text-[#7D6F61]" />
                    <span>本地 IndexedDB 存储用量</span>
                  </div>
                  <span className="text-xs font-mono font-medium text-[#4A3F35]">
                    {storageInfo.usageText} / {storageInfo.quotaText}
                  </span>
                </div>

                {/* Storage Bar */}
                <div className="w-full h-2 bg-[#DDD3C4] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#7D6F61] transition-all rounded-full"
                    style={{ width: `${Math.max(2, storageInfo.percentage)}%` }}
                  />
                </div>

                {/* Statistics Grid */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E2D8C9] text-center">
                  <div>
                    <div className="text-base font-bold font-serif text-[#382F26]">{dbStats.notebookCount}</div>
                    <div className="text-[10px] text-[#8C7E70]">手账本</div>
                  </div>
                  <div>
                    <div className="text-base font-bold font-serif text-[#382F26]">{dbStats.itemCount}</div>
                    <div className="text-[10px] text-[#8C7E70]">贴图/便签</div>
                  </div>
                  <div>
                    <div className="text-base font-bold font-serif text-[#382F26]">{dbStats.mediaCount}</div>
                    <div className="text-[10px] text-[#8C7E70]">照片与视频</div>
                  </div>
                </div>
              </div>

              {/* Backup and Restore Actions */}
              <div className="space-y-3">
                <h4 className="font-serif font-bold text-sm text-[#382F26]">备份与数据恢复</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={isExporting}
                    className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#FFFFFF] border border-[#DDD4C7] hover:border-[#8C7E70] text-xs font-medium text-[#382F26] shadow-xs transition-all active:scale-98"
                  >
                    <Download className="w-4 h-4 text-[#7D6F61]" />
                    <span>{isExporting ? '导出中...' : '导出手账备份 (JSON)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleImportClick}
                    disabled={isImporting}
                    className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#FFFFFF] border border-[#DDD4C7] hover:border-[#8C7E70] text-xs font-medium text-[#382F26] shadow-xs transition-all active:scale-98"
                  >
                    <Upload className="w-4 h-4 text-[#7D6F61]" />
                    <span>{isImporting ? '恢复中...' : '导入手账备份文件'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-[#9E9082] leading-relaxed">
                  导出功能将所有手账的排版坐标、文字便签与元数据生成结构化 JSON 备份。重新导入即可还原排版。
                </p>
              </div>

              {/* Danger Zone: Reset Data */}
              <div className="pt-4 border-t border-[#EAE3D6] space-y-3">
                <h4 className="font-serif font-bold text-sm text-[#A85B5B] flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4" />
                  <span>危险区域</span>
                </h4>

                {!isResetConfirmOpen ? (
                  <button
                    type="button"
                    onClick={() => setIsResetConfirmOpen(true)}
                    className="w-full py-2.5 px-4 rounded-xl border border-[#E5B5B5] bg-[#FFF8F8] text-[#A85B5B] hover:bg-[#FFEAEA] text-xs font-medium transition-colors"
                  >
                    清空全部手账数据与图片视频
                  </button>
                ) : (
                  <div className="p-3.5 rounded-xl border border-[#E5A0A0] bg-[#FFF2F2] space-y-2.5">
                    <p className="text-xs text-[#8A3B3B] leading-relaxed">
                      确定要删除所有的手账本、贴纸、照片和视频吗？此操作无法撤销。
                    </p>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setIsResetConfirmOpen(false)}
                        className="px-3 py-1.5 rounded-lg text-xs text-[#55483B] bg-white border border-[#DDD3C6]"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmReset}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#C53929] hover:bg-[#A82B1D]"
                      >
                        确认彻底清空
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ABOUT & PRIVACY */}
          {activeTab === 'about' && (
            <div className="space-y-5">
              {/* 100% Privacy Guarantee */}
              <div className="p-4 rounded-2xl bg-[#EFEBE4] border border-[#DDD3C5] space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#382F26]">
                  <ShieldCheck className="w-4 h-4 text-[#476B3C]" />
                  <span>100% 离线与隐私保护承诺</span>
                </div>
                <p className="text-xs text-[#6B5E51] leading-relaxed">
                  本手账应用设计为<strong>Local-First 本地优先</strong>架构。所有手账本、文字记录、高画质照片和视频剪辑均存储在您当前设备的浏览器
                  IndexedDB 数据库中。无需注册账号，绝不向任何第三方云服务器发送或同步您的私人手账内容。
                </p>
              </div>

              {/* Deployment Info */}
              <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6DFD4] space-y-2 text-xs">
                <div className="font-semibold text-[#382F26] flex items-center justify-between">
                  <span>GitHub Pages 静态托管</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#EBF0E6] text-[#3D5230] text-[10px] font-medium">
                    静态独立部署
                  </span>
                </div>
                <div className="font-mono text-[11px] text-[#6B5E51] bg-[#F5F1EB] p-2 rounded-lg break-all">
                  https://yuivo9999.github.io/travelbook123/
                </div>
                <p className="text-[11px] text-[#9E9082]">
                  支持通过 GitHub Actions 一键构建并自动发布至 GitHub Pages。
                </p>
              </div>

              {/* Usage Tips */}
              <div className="space-y-2">
                <h4 className="font-serif font-bold text-xs text-[#382F26]">操作小技巧</h4>
                <ul className="text-xs text-[#6B5E51] space-y-1.5 list-disc list-inside">
                  <li>
                    <strong>截图粘贴</strong>: 在手账页面内直接按下 <kbd className="px-1.5 py-0.5 bg-[#EAE3D6] rounded text-[10px]">Ctrl+V</kbd> 即可直接贴上剪贴板图片。
                  </li>
                  <li>
                    <strong>拖拽导入</strong>: 直接将电脑中的图片或视频文件拖拽到手账纸张上即可自动贴上。
                  </li>
                  <li>
                    <strong>手账纸张自适应</strong>: 随着摆放内容的增加，手账纸张高度会自动根据最底部的元素平滑向下延展。
                  </li>
                  <li>
                    <strong>多媒体全屏</strong>: 点击图片即可开启高清灯箱查看，点击视频即可无损播放。
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-7 py-3 border-t border-[#EAE3D6] bg-[#F4EFEA]/80 flex items-center justify-between text-[11px] text-[#8C7E70]">
          <span>Travelbook · 数字手账 WebApp</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#4A3F35] text-[#FAF7F2] font-medium text-xs hover:bg-[#382F26] transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
