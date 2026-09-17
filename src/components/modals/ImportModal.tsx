import React, { useEffect, useMemo, useState } from 'react';
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
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
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
  const [nameHandling, setNameHandling] = useState<'copy' | 'overwrite'>('copy');
  const [isImporting, setIsImporting] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');

  // 每次打开新的备份预览时，默认全选，避免沿用上一次导入选择。
  useEffect(() => {
    if (!isOpen || !backup) return;
    setSelectedNotebookIds(backup.notebooks.map((n) => n.id));
    setNameHandling('copy');
    setProgressPercent(0);
    setProgressStatus('');
  }, [isOpen, backup]);

  const selectedStats = useMemo(() => {
    if (!backup) {
      return { itemsCount: 0, textCount: 0, imageCount: 0, videoCount: 0, mediaCount: 0, mediaSize: 0 };
    }
    const selected = new Set(selectedNotebookIds);
    const items = backup.items.filter((item) => selected.has(item.notebookId));
    const media = backup.media.filter((entry) => selected.has(entry.notebookId));
    const mediaSize = media.reduce((sum, entry) => {
      const blob = backup.mediaBlobs.get(entry.id);
      return sum + (blob?.size ?? entry.fileSize ?? 0);
    }, 0);

    return {
      itemsCount: items.length,
      textCount: items.filter((item) => item.type === 'text').length,
      imageCount: items.filter((item) => item.type === 'image').length,
      videoCount: items.filter((item) => item.type === 'video').length,
      mediaCount: media.length,
      mediaSize,
    };
  }, [backup, selectedNotebookIds]);

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  };

  if (!isOpen || !backup) return null;

  // 备份包原始信息
  const hasFullMedia = backup.media.length === 0 || Array.from(backup.mediaBlobs.values() as Iterable<Blob>).every((blob) => blob.size > 0);
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
                ZIP 全量备份恢复（完整还原文字、排版、照片与视频）
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
          {/* 备份文件信息卡片：与导出界面保持同一层级的预览结构 */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#E3D9CC] space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#F0EAE1]">
              <span className="font-bold text-[#382F26] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#8C7E70]" />
                <span>导入备份预览</span>
              </span>
              <span className="text-[11px] font-medium text-[#4A5D4E] bg-[#E8F0E8] px-2 py-0.5 rounded-md border border-[#D0E0D0]">
                ZIP 全量备份
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-[#FAF7F2] border border-[#ECE5DA]">
                <div className="text-[10px] text-[#8C7E70] flex items-center justify-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  <span>手账本</span>
                </div>
                <div className="font-mono font-bold text-sm text-[#2D241E] mt-0.5">{selectedNotebookIds.length}</div>
              </div>
              <div className="p-2 rounded-xl bg-[#FAF7F2] border border-[#ECE5DA]">
                <div className="text-[10px] text-[#8C7E70] flex items-center justify-center gap-1">
                  <FileText className="w-3 h-3" />
                  <span>内容</span>
                </div>
                <div className="font-mono font-bold text-sm text-[#2D241E] mt-0.5">{selectedStats.itemsCount}</div>
              </div>
              <div className="p-2 rounded-xl bg-[#FAF7F2] border border-[#ECE5DA]">
                <div className="text-[10px] text-[#8C7E70] flex items-center justify-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  <span>媒体</span>
                </div>
                <div className="font-mono font-bold text-sm text-[#2D241E] mt-0.5">{selectedStats.mediaCount}</div>
              </div>
            </div>

            <div className="text-[11px] text-[#7A6C5D] space-y-1 pt-1">
              <div className="flex items-center justify-between">
                <span>备份生成时间</span>
                <span className="font-medium text-[#382F26]">{new Date(backup.exportedAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>原始媒体大小</span>
                <span className="font-mono font-medium text-[#382F26]">{formatBytes(selectedStats.mediaSize)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>备份版本</span>
                <span className="font-mono text-[#382F26]">v{backup.version}</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#F4EFEA] border border-[#E5DFD4] text-[11px] text-[#6E6152]">
              <div className="flex items-center justify-between gap-3">
                <span>ZIP 压缩策略</span>
                <span className="font-medium text-[#4A5D4E]">均衡模式</span>
              </div>
              <div className="mt-1 text-[10px] text-[#8C7E70]">
                元信息使用 DEFLATE；MP4、MOV、JPG、PNG 等已压缩媒体保持原样，避免导入时额外耗时。
              </div>
              {backup.compression && (
                <div className="mt-1 text-[10px] text-[#8C7E70]">
                  当前备份约为原始条目数据的 {(backup.compression.ratio * 100).toFixed(1)}%
                </div>
              )}
            </div>

            {!hasFullMedia && (
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-[#F8EEE5] border border-[#E7D3BE] text-[11px] text-[#6B4B35]">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>备份中的部分原始媒体无法读取，本次导入将被阻止，不会用缩略图替代原文件。</span>
              </div>
            )}
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

          {/* 2. 当前选择的导入内容统计：对应导出界面的范围预览 */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#E3D9CC] space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#F0EAE1]">
              <span className="font-bold text-[#382F26] flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-[#8C7E70]" />
                <span>本次导入范围预览</span>
              </span>
              <span className="text-[11px] text-[#8C7E70]">{selectedNotebookIds.length}/{totalNotebooks} 本</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-[#FAF7F2] border border-[#ECE5DA]">
                <div className="text-[10px] text-[#8C7E70] flex items-center justify-center gap-1"><FileText className="w-3 h-3" />便签排版</div>
                <div className="font-mono font-bold text-sm mt-0.5">{selectedStats.textCount}</div>
              </div>
              <div className="p-2 rounded-xl bg-[#FAF7F2] border border-[#ECE5DA]">
                <div className="text-[10px] text-[#8C7E70] flex items-center justify-center gap-1"><ImageIcon className="w-3 h-3" />高清照片</div>
                <div className="font-mono font-bold text-sm mt-0.5">{selectedStats.imageCount}</div>
              </div>
              <div className="p-2 rounded-xl bg-[#FAF7F2] border border-[#ECE5DA]">
                <div className="text-[10px] text-[#8C7E70] flex items-center justify-center gap-1"><VideoIcon className="w-3 h-3" />原画视频</div>
                <div className="font-mono font-bold text-sm mt-0.5">{selectedStats.videoCount}</div>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-[#7A6C5D] pt-1">
              <span>待恢复原始媒体</span>
              <span className="font-mono font-medium text-[#382F26]">{formatBytes(selectedStats.mediaSize)}</span>
            </div>
          </div>

          {/* 3. 选择导入内容范围 */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#4A3F35] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#7D6F61]" />
              <span>导入模式：ZIP 全量导入</span>
            </label>

            <div className="grid grid-cols-1 gap-2">
              {/* Option A: 全部内容 */}
              <button
                type="button"
                className="p-3 rounded-xl border border-[#524436] bg-white ring-1 ring-[#524436] text-left flex flex-col gap-1 cursor-default"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#2D241E] flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-[#4A5D4E]" />
                    <span>导入全部内容 (完整复原)</span>
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-[#524436]" />
                </div>
                <p className="text-[11px] text-[#7A6C5D]">
                  将自动复原备份中的所有数据，包括高清照片、原始视频与排版。
                </p>
              </button>
            </div>
          </div>

          {/* 4. 同名手账本处理方式 */}
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
        <div className="px-5 sm:px-6 py-3.5 border-t border-[#EAE3D6] flex items-center justify-between gap-3 bg-[#F4EFEA]/80">
          <div className="text-[11px] text-[#8C7E70] truncate">
            {selectedNotebookIds.length > 0
              ? `准备导入 ${selectedNotebookIds.length} 本 · ${selectedStats.itemsCount} 项内容 · ${formatBytes(selectedStats.mediaSize)} 媒体`
              : '请至少选择一本手账'}
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
    </div>
  );
};
