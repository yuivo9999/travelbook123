import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  BookOpen,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  HardDrive,
  Link as LinkIcon,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Notebook } from '../../types';
import { getAllNotebooks, getItemsByNotebook } from '../../db/store';
import { exportScrapbookData, ExportMode } from '../../utils/exportImport';

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
  const [exportMode, setExportMode] = useState<ExportMode>('lightweight');
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
          // keep
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
        mode: exportMode,
        onProgress: (percent, status) => {
          setProgressPercent(percent);
          setProgressStatus(status);
        },
      });

      showToast('手账数据已成功导出为 JSON 文件', 'success');
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
              <p className="text-[11px] text-[#8C7E70]">自定义选择手账本与媒体导出范围</p>
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
          {/* 1. 选择导出哪一个手账本 */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#4A3F35] flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-[#7D6F61]" />
              <span>选择要导出的手账本</span>
            </label>

            <select
              value={selectedNotebookId}
              onChange={(e) => setSelectedNotebookId(e.target.value)}
              disabled={isExporting}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#DDD4C7] text-xs sm:text-sm text-[#2D241E] focus:outline-hidden focus:ring-1 focus:ring-[#524436] transition-all"
            >
              <option value="all">📦 导出全部手账本 ({notebooks.length} 本)</option>
              <optgroup label="单手账本导出">
                {notebooks.map((nb) => (
                  <option key={nb.id} value={nb.id}>
                    📖 {nb.title}
                  </option>
                ))}
              </optgroup>
            </select>

            {/* 当前所选手账本简短信息 */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#F0EAE1]/70 border border-[#E3D9CC] text-[11px] text-[#6E6152]">
              <span className="font-medium text-[#4A3F35]">
                {selectedNotebookId === 'all'
                  ? `已选择全部 ${notebooks.length} 本手账`
                  : `已选择单本: ${currentNotebook?.title || '手账'}`}
              </span>
              <span className="text-[#B3A696]">|</span>
              <div className="flex items-center gap-2">
                <span>便签: {selectedStats.textCount}</span>
                <span>照片: {selectedStats.imageCount}</span>
                <span>视频: {selectedStats.videoCount}</span>
              </div>
            </div>
          </div>

          {/* 2. 选择导出内容范围与模式 */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-[#4A3F35] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#7D6F61]" />
              <span>选择导出内容范围</span>
            </label>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Option A: 轻量便携备份 (文字 + 图片缩略图/原文件链接 + 视频预览图/原文件链接) */}
              <button
                type="button"
                onClick={() => setExportMode('lightweight')}
                disabled={isExporting}
                className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col gap-1.5 ${
                  exportMode === 'lightweight'
                    ? 'border-[#524436] bg-white shadow-xs ring-1 ring-[#524436]'
                    : 'border-[#DDD4C7] hover:border-[#BDB0A0] bg-[#FAF7F2]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium text-xs sm:text-sm text-[#2D241E]">
                    <Sparkles className="w-4 h-4 text-[#B8860B]" />
                    <span>轻量便携备份 (推荐)</span>
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-[#EAE2D5] text-[#594B3C]">
                      体积小·易分享
                    </span>
                  </div>
                  {exportMode === 'lightweight' && (
                    <CheckCircle2 className="w-4 h-4 text-[#524436]" />
                  )}
                </div>
                <p className="text-[11px] text-[#786C5E] leading-relaxed">
                  包含<b>全部文字纸片与排版</b>、<b>图片缩略图</b>（含上传时图片文件原名与超链接地址）、以及<b>视频预览图</b>（含视频原始文件地址超链接）。
                </p>
                <div className="text-[10px] text-[#9E9082] flex items-center gap-1 mt-0.5">
                  <LinkIcon className="w-3 h-3 text-[#7D6F61]" />
                  <span>支持保留原文件超链接追溯，导出文件仅几十至几百 KB</span>
                </div>
              </button>

              {/* Option B: 全部内容 (完整离线大包) */}
              <button
                type="button"
                onClick={() => setExportMode('full')}
                disabled={isExporting}
                className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col gap-1.5 ${
                  exportMode === 'full'
                    ? 'border-[#524436] bg-white shadow-xs ring-1 ring-[#524436]'
                    : 'border-[#DDD4C7] hover:border-[#BDB0A0] bg-[#FAF7F2]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium text-xs sm:text-sm text-[#2D241E]">
                    <HardDrive className="w-4 h-4 text-[#4A5D4E]" />
                    <span>全部内容 (完整原始媒体)</span>
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-[#E0E8E1] text-[#344838]">
                      完全离线
                    </span>
                  </div>
                  {exportMode === 'full' && (
                    <CheckCircle2 className="w-4 h-4 text-[#524436]" />
                  )}
                </div>
                <p className="text-[11px] text-[#786C5E] leading-relaxed">
                  除文字与排版外，将<b>完整的高清原图和原始视频</b>全部打包嵌入 JSON 文件中，无需外部源文件即可在任何设备 100% 完整复原。
                </p>
                <div className="text-[10px] text-[#A67878] flex items-center gap-1 mt-0.5">
                  <span>⚠️ 若手账包含长视频，导出的 JSON 文件体积会随之增大</span>
                </div>
              </button>
            </div>
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
        <div className="px-5 sm:px-6 py-3.5 border-t border-[#EAE3D6] flex items-center justify-end gap-2 bg-[#F4EFEA]/80">
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
            <span>{isExporting ? '正在导出...' : '确认导出备份'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
