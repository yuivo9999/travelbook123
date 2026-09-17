import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  BookOpen,
  CheckCircle2,
  HardDrive,
  Layers,
  Sparkles,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Check,
} from 'lucide-react';
import { Notebook } from '../../types';
import { getAllNotebooks, getItemsByNotebook } from '../../db/indexedDB';
import { exportScrapbookData } from '../../utils/exportImport';

interface ExportModalProps {
  isOpen: boolean;
  initialNotebookId?: string; // 如果从某本手账内打开，默认选中该本
  onClose: () => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  initialNotebookId,
  onClose,
  showToast,
}) => {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [selectedStats, setSelectedStats] = useState<{
    itemsCount: number;
    imageCount: number;
    videoCount: number;
    textCount: number;
  }>({ itemsCount: 0, imageCount: 0, videoCount: 0, textCount: 0 });

  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      try {
        const allNbs = await getAllNotebooks();
        setNotebooks(allNbs);

        if (initialNotebookId && allNbs.some((n) => n.id === initialNotebookId)) {
          setSelectedNotebookId(initialNotebookId);
        } else if (allNbs.length > 0 && selectedNotebookId !== 'all') {
          // keep existing selection if valid
          if (!allNbs.some((n) => n.id === selectedNotebookId)) {
            setSelectedNotebookId(allNbs.length === 1 ? allNbs[0].id : 'all');
          }
        } else {
          setSelectedNotebookId(allNbs.length === 1 ? allNbs[0].id : 'all');
        }
      } catch (err) {
        console.error('Failed to load notebooks for export', err);
      }
    }

    loadData();
  }, [isOpen, initialNotebookId]);

  // 计算当前所选范围的内容统计
  useEffect(() => {
    if (!isOpen) return;

    async function calculateStats() {
      try {
        let itemsToCount: any[] = [];
        if (selectedNotebookId === 'all') {
          for (const nb of notebooks) {
            const items = await getItemsByNotebook(nb.id);
            itemsToCount.push(...items);
          }
        } else {
          itemsToCount = await getItemsByNotebook(selectedNotebookId);
        }

        const images = itemsToCount.filter((it) => it.type === 'image').length;
        const videos = itemsToCount.filter((it) => it.type === 'video').length;
        const texts = itemsToCount.filter((it) => it.type === 'text').length;

        setSelectedStats({
          itemsCount: itemsToCount.length,
          imageCount: images,
          videoCount: videos,
          textCount: texts,
        });
      } catch (e) {
        console.warn('Failed to calculate stats', e);
      }
    }

    calculateStats();
  }, [selectedNotebookId, notebooks, isOpen]);

  if (!isOpen) return null;

  const handleStartExport = async () => {
    try {
      setIsExporting(true);
      setProgressPercent(5);
      setProgressStatus('准备导出数据...');

      await exportScrapbookData({
        targetNotebookId: selectedNotebookId,
        mode: 'full',
        onProgress: (percent, status) => {
          setProgressPercent(percent);
          setProgressStatus(status);
        },
      });

      const currentNbName =
        selectedNotebookId === 'all'
          ? '全部手账本'
          : notebooks.find((n) => n.id === selectedNotebookId)?.title || '选定手账';

      showToast(`《${currentNbName}》全量备份数据已成功导出！`, 'success');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : '导出失败', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const currentNotebook = notebooks.find((nb) => nb.id === selectedNotebookId);
  const dateStr = new Date().toISOString().slice(0, 10);
  const previewFilename = `手账全量备份_${
    selectedNotebookId === 'all'
      ? '全部手账'
      : (currentNotebook?.title || '单本手账').replace(/[\\/:*?"<>|]/g, '_')
  }_${dateStr}.zip`;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-fade-in"
      onClick={!isExporting ? onClose : undefined}
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
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-[#2D241E]">导出手账备份</h3>
              <p className="text-[11px] text-[#8C7E70]">支持单本备份或完整备份（含文字、排版与原始多媒体）</p>
            </div>
          </div>
          {!isExporting && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8C7E70] hover:text-[#382F26] hover:bg-[#EAE3D6] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-[#382F26]">
          {/* 1. 选择要导出的手账本范围 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#4A3F35] flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#7D6F61]" />
                <span>选择导出手账本范围</span>
              </label>
              <span className="text-[11px] text-[#8C7E70]">
                {selectedNotebookId === 'all'
                  ? `已选全部 (${notebooks.length} 本)`
                  : '已指定单本导出'}
              </span>
            </div>

            {/* 手账本选择平铺卡片列表 */}
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {/* 全部手账本选项 */}
              <div
                onClick={() => !isExporting && setSelectedNotebookId('all')}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  selectedNotebookId === 'all'
                    ? 'bg-[#FFFFFF] border-[#524436] shadow-xs ring-1 ring-[#524436]'
                    : 'bg-[#F4EFEA]/60 border-[#E5DFD4] hover:bg-white hover:border-[#C8BEB0]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#E8DFD3] flex items-center justify-center text-xs text-[#4A3F35] font-bold">
                    📦
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#2D241E]">
                      导出全项目所有手账本
                    </div>
                    <div className="text-[10px] text-[#8C7E70]">
                      将项目内包含的 {notebooks.length} 本手账一次性完整导出
                    </div>
                  </div>
                </div>
                {selectedNotebookId === 'all' && (
                  <CheckCircle2 className="w-4 h-4 text-[#524436] shrink-0" />
                )}
              </div>

              {/* 单本手账本列表 */}
              <div className="pt-1 space-y-1.5">
                <div className="text-[10px] font-semibold text-[#8C7E70] uppercase tracking-wider px-1">
                  按单本选择导出:
                </div>
                {notebooks.map((nb) => {
                  const isSelected = selectedNotebookId === nb.id;
                  return (
                    <div
                      key={nb.id}
                      onClick={() => !isExporting && setSelectedNotebookId(nb.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-[#FFFFFF] border-[#524436] shadow-xs ring-1 ring-[#524436]'
                          : 'bg-[#F4EFEA]/60 border-[#E5DFD4] hover:bg-white hover:border-[#C8BEB0]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs text-white font-bold"
                          style={{ backgroundColor: nb.coverColor || '#8B7355' }}
                        >
                          📖
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#2D241E] truncate">
                            {nb.title}
                          </div>
                          <div className="text-[10px] text-[#8C7E70] truncate">
                            {nb.coverText || '全量存储手账'}
                          </div>
                        </div>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-[#524436] shrink-0 ml-2" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-[#D0C5B6] shrink-0 ml-2" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2. 当前导出包含的统计与文件名预览 */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#E3D9CC] space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#F0EAE1]">
              <span className="font-bold text-[#382F26] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#8C7E70]" />
                <span>导出范围预览</span>
              </span>
              <span className="text-[11px] font-medium text-[#4A5D4E] bg-[#E8F0E8] px-2 py-0.5 rounded-md border border-[#D0E0D0]">
                {selectedNotebookId === 'all' ? '多本合并导出' : '单本独立导出'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-[#FAF7F2] border border-[#ECE5DA]">
                <div className="text-[10px] text-[#8C7E70] flex items-center justify-center gap-1">
                  <FileText className="w-3 h-3" />
                  <span>便签排版</span>
                </div>
                <div className="font-mono font-bold text-sm text-[#2D241E] mt-0.5">
                  {selectedStats.textCount}
                </div>
              </div>

              <div className="p-2 rounded-xl bg-[#FAF7F2] border border-[#ECE5DA]">
                <div className="text-[10px] text-[#8C7E70] flex items-center justify-center gap-1">
                  <ImageIcon className="w-3 h-3" />
                  <span>高清照片</span>
                </div>
                <div className="font-mono font-bold text-sm text-[#2D241E] mt-0.5">
                  {selectedStats.imageCount}
                </div>
              </div>

              <div className="p-2 rounded-xl bg-[#FAF7F2] border border-[#ECE5DA]">
                <div className="text-[10px] text-[#8C7E70] flex items-center justify-center gap-1">
                  <VideoIcon className="w-3 h-3" />
                  <span>原画视频</span>
                </div>
                <div className="font-mono font-bold text-sm text-[#2D241E] mt-0.5">
                  {selectedStats.videoCount}
                </div>
              </div>
            </div>

            <div className="text-[11px] text-[#7A6C5D] space-y-1 pt-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[#8C7E70]">生成的备份文件名:</span>
                <span className="font-mono text-[#382F26] font-medium truncate max-w-[220px]">
                  {previewFilename}
                </span>
              </div>
            </div>
          </div>

          {/* 3. ZIP 全量备份模式 */}
          <div className="p-3 rounded-xl bg-[#F4EFEA] border border-[#E5DFD4] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#4A5D4E]" />
              <div>
                <div className="font-medium text-[#2D241E]">ZIP 全量备份</div>
                <div className="text-[10px] text-[#8C7E70]">
                  ZIP 内直接保存高清图像与原始视频，不再使用 JSON Base64 作为备份文件
                </div>
              </div>
            </div>
            <Check className="w-4 h-4 text-[#4A5D4E]" />
          </div>

          {/* 导出进度条 */}
          {isExporting && (
            <div className="space-y-2 p-3.5 rounded-xl bg-[#F2ECE2] border border-[#E0D6C8] animate-pulse">
              <div className="flex items-center justify-between text-xs font-medium text-[#4A3F35]">
                <span>{progressStatus || '正在导出手账...'}</span>
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
        <div className="px-5 sm:px-6 py-3.5 border-t border-[#EAE3D6] flex items-center justify-between gap-2 bg-[#F4EFEA]/80">
          <div className="text-[11px] text-[#8C7E70]">
            {selectedNotebookId === 'all'
              ? '即将导出全部手账'
              : `即将导出《${currentNotebook?.title || '手账'}》`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#6E6152] hover:bg-[#EAE3D6] transition-colors"
            >
              取消
            </button>

            <button
              type="button"
              id="btn-confirm-export"
              onClick={handleStartExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4A3F35] hover:bg-[#382F26] text-white text-xs font-medium shadow-xs transition-all active:scale-95 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {isExporting
                  ? '正在导出...'
                  : selectedNotebookId === 'all'
                  ? '导出全部手账'
                  : '导出当前选中手账'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

