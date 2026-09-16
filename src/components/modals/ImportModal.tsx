import React, { useState } from 'react';
import {
  X,
  Upload,
  BookOpen,
  CheckCircle2,
  Check,
  AlertCircle,
  Sparkles,
  HardDrive,
  Layers,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { ScrapbookBackup, executeImport } from '../../utils/exportImport';

interface ImportModalProps {
  isOpen: boolean;
  backup: ScrapbookBackup | null;
  onClose: () => void;
  onImportSuccess: () => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  backup,
  onClose,
  onImportSuccess,
  showToast,
}) => {
  const [selectedNotebookIds, setSelectedNotebookIds] = useState<string[]>(() => {
    return backup ? backup.notebooks.map((n) => n.id) : [];
  });
  const [importMode, setImportMode] = useState<'full' | 'lightweight'>(() => {
    return backup?.exportType === 'full' ? 'full' : 'lightweight';
  });
  const [nameHandling, setNameHandling] = useState<'copy' | 'overwrite'>('copy');
  const [isImporting, setIsImporting] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');

  if (!isOpen || !backup) return null;

  // 备份包原始信息
  const hasFullMedia = backup.media.some((m) => Boolean(m.fullBlobBase64));
  const totalNotebooks = backup.notebooks.length;

  const handleToggleNotebook = (id: string) => {
    setSelectedNotebookIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) {
          showToast('请至少选择一本要导入的手账', 'info');
          return prev;
        }
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedNotebookIds(backup.notebooks.map((n) => n.id));
  };

  const handleStartImport = async () => {
    if (selectedNotebookIds.length === 0) {
      showToast('请选择至少一本要导入的手账', 'error');
      return;
    }

    try {
      setIsImporting(true);
      setProgressPercent(10);
      setProgressStatus('开始解析并导入数据...');

      const result = await executeImport({
        backup,
        selectedNotebookIds,
        importMode,
        nameHandling,
        onProgress: (percent, status) => {
          setProgressPercent(percent);
          setProgressStatus(status);
        },
      });

      showToast(
        `成功恢复 ${result.importedNotebooks} 本手账，共 ${result.importedItems} 项内容！`,
        'success'
      );
      setTimeout(() => {
        onImportSuccess();
        onClose();
      }, 700);
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : '导入失败', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-fade-in"
      onClick={!isImporting ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-lg bg-[#FAF7F2] rounded-2xl sm:rounded-3xl border border-[#E6E0D6] shadow-[0_20px_50px_rgba(45,35,25,0.18)] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-[#EAE3D6] flex items-center justify-between bg-[#F4EFEA]/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E8DFD3] border border-[#D9CFC1] flex items-center justify-center text-[#524436]">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-[#2D241E]">导入手账数据</h3>
              <p className="text-[11px] text-[#8C7E70]">
                选择导入哪一本手账及媒体恢复模式
              </p>
            </div>
          </div>
          {!isImporting && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8C7E70] hover:text-[#382F26] hover:bg-[#EAE3D6] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-[#382F26]">
          {/* 备份文件信息卡片 */}
          <div className="p-3.5 rounded-xl bg-[#F0EAE1]/70 border border-[#E3D9CC] flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-[#4A3F35]">备份源文件信息</span>
              <div className="text-[11px] text-[#7A6C5D] mt-0.5">
                导出时间: {backup.exportedAt.slice(0, 10)} · 包含 {backup.items.length} 个便签贴图 · {backup.media.length} 份媒体
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${
                hasFullMedia
                  ? 'bg-[#E1EAE2] text-[#344838]'
                  : 'bg-[#ECE4D8] text-[#615141]'
              }`}
            >
              {hasFullMedia ? '含完整原媒体' : '轻量缩略图版'}
            </span>
          </div>

          {/* 1. 选择导入哪一个手账本 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#4A3F35] flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#7D6F61]" />
                <span>选择要导入的手账本 ({selectedNotebookIds.length}/{totalNotebooks})</span>
              </label>

              {totalNotebooks > 1 && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] text-[#6E5D4B] hover:underline"
                >
                  全选所有手账
                </button>
              )}
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1.5 p-1 rounded-xl bg-white/70 border border-[#DDD4C7]">
              {backup.notebooks.map((nb) => {
                const isSelected = selectedNotebookIds.includes(nb.id);
                const itemsCount = backup.items.filter((it) => it.notebookId === nb.id).length;

                return (
                  <button
                    key={nb.id}
                    type="button"
                    onClick={() => handleToggleNotebook(nb.id)}
                    disabled={isImporting}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-all ${
                      isSelected
                        ? 'bg-[#F4EFEA] text-[#2D241E] border border-[#DDD3C5]'
                        : 'hover:bg-[#FAF7F2] text-[#6E6152] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-[#4A3F35] border-[#4A3F35] text-white'
                            : 'border-[#CCC2B4] bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="text-xs font-medium">{nb.title}</span>
                    </div>

                    <span className="text-[11px] text-[#8C7E70]">
                      {itemsCount} 份剪贴
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. 选择导入内容范围 */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#4A3F35] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#7D6F61]" />
              <span>选择导入内容范围</span>
            </label>

            <div className="grid grid-cols-1 gap-2">
              {/* Option A: 全部内容 */}
              <button
                type="button"
                onClick={() => setImportMode('full')}
                disabled={isImporting || !hasFullMedia}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  importMode === 'full'
                    ? 'border-[#524436] bg-white ring-1 ring-[#524436]'
                    : 'border-[#DDD4C7] bg-[#FAF7F2] opacity-80'
                } ${!hasFullMedia ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#2D241E] flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-[#4A5D4E]" />
                    <span>导入全部内容 (含完整高清原媒体)</span>
                  </span>
                  {importMode === 'full' && (
                    <CheckCircle2 className="w-4 h-4 text-[#524436]" />
                  )}
                </div>
                <p className="text-[11px] text-[#7A6C5D]">
                  {hasFullMedia
                    ? '完整复原备份中的所有高清照片原图与完整视频。'
                    : '该备份文件中未打包完整大文件，仅包含缩略图与原文件超链接。'}
                </p>
              </button>

              {/* Option B: 轻量导入 */}
              <button
                type="button"
                onClick={() => setImportMode('lightweight')}
                disabled={isImporting}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  importMode === 'lightweight'
                    ? 'border-[#524436] bg-white ring-1 ring-[#524436]'
                    : 'border-[#DDD4C7] bg-[#FAF7F2]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#2D241E] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#B8860B]" />
                    <span>仅导入文字与缩略图预览 (原文件超链接追溯)</span>
                  </span>
                  {importMode === 'lightweight' && (
                    <CheckCircle2 className="w-4 h-4 text-[#524436]" />
                  )}
                </div>
                <p className="text-[11px] text-[#7A6C5D]">
                  导入文字纸片、图片缩略图、视频预览图以及原始文件地址超链接。极大节省浏览器存储空间！
                </p>
              </button>
            </div>
          </div>

          {/* 3. 同名手账本处理方式 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#4A3F35]">同名手账处理</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNameHandling('copy')}
                className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                  nameHandling === 'copy'
                    ? 'border-[#524436] bg-white font-medium text-[#2D241E]'
                    : 'border-[#DDD4C7] text-[#6E6152] bg-[#FAF7F2]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5" />
                  <span>新建为副本</span>
                </div>
                <div className="text-[10px] text-[#8C7E70] mt-0.5">自动添加“(导入副本)”</div>
              </button>

              <button
                type="button"
                onClick={() => setNameHandling('overwrite')}
                className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                  nameHandling === 'overwrite'
                    ? 'border-[#524436] bg-white font-medium text-[#2D241E]'
                    : 'border-[#DDD4C7] text-[#6E6152] bg-[#FAF7F2]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>覆盖同名手账</span>
                </div>
                <div className="text-[10px] text-[#8C7E70] mt-0.5">直接合并覆盖现有手账</div>
              </button>
            </div>
          </div>

          {/* 导入进度条 */}
          {isImporting && (
            <div className="space-y-2 p-3.5 rounded-xl bg-[#F2ECE2] border border-[#E0D6C8] animate-pulse">
              <div className="flex items-center justify-between text-xs font-medium text-[#4A3F35]">
                <span>{progressStatus || '正在恢复数据...'}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-[#E0D7C9] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#524436] transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-[#EAE3D6] flex items-center justify-end gap-2 bg-[#F4EFEA]/80">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[#6E6152] hover:bg-[#EAE3D6] transition-colors"
          >
            取消
          </button>

          <button
            type="button"
            id="btn-confirm-execute-import"
            onClick={handleStartImport}
            disabled={isImporting || selectedNotebookIds.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4A3F35] hover:bg-[#382F26] text-white text-xs font-medium shadow-xs transition-all active:scale-95 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isImporting ? '正在恢复...' : `确认导入选中的 ${selectedNotebookIds.length} 本手账`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
