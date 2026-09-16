import React, { useState } from 'react';
import { Plus, BookOpen, Settings, Sparkles, X, Download } from 'lucide-react';
import { Notebook } from '../types';
import { NotebookCard } from './NotebookCard';
import { ConfirmDialog } from './modals/ConfirmDialog';
import { ExportModal } from './modals/ExportModal';
import { EditCoverModal } from './modals/EditCoverModal';
import { saveNotebook } from '../db/indexedDB';

interface NotebookShelfProps {
  notebooks: Notebook[];
  onCreateNotebook: (title: string) => Promise<string>;
  onOpenNotebook: (id: string) => void;
  onDeleteNotebook: (id: string) => Promise<void>;
  onUpdateNotebook?: (updated: Notebook) => void;
  onOpenSettings: () => void;
  showToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const NotebookShelf: React.FC<NotebookShelfProps> = ({
  notebooks,
  onCreateNotebook,
  onOpenNotebook,
  onDeleteNotebook,
  onUpdateNotebook,
  onOpenSettings,
  showToast = () => {},
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Notebook deletion state
  const [notebookToDelete, setNotebookToDelete] = useState<Notebook | null>(null);

  // Notebook cover editing state
  const [notebookToEditCover, setNotebookToEditCover] = useState<Notebook | null>(null);

  // Notebook export modal state
  const [exportModalState, setExportModalState] = useState<{
    isOpen: boolean;
    notebookId?: string;
  }>({ isOpen: false });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const newId = await onCreateNotebook(newTitle.trim());
      setNewTitle('');
      setIsCreateModalOpen(false);
      // Immediately enter the newly created notebook
      onOpenNotebook(newId);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!notebookToDelete) return;
    const id = notebookToDelete.id;
    setNotebookToDelete(null);
    await onDeleteNotebook(id);
  };

  const handleSaveCover = async (coverData: {
    coverType: any;
    coverText?: string;
    coverImageData?: string;
    coverImageId?: string;
  }) => {
    if (!notebookToEditCover) return;
    const updated: Notebook = {
      ...notebookToEditCover,
      ...coverData,
      updatedAt: Date.now(),
    };
    await saveNotebook(updated);
    onUpdateNotebook?.(updated);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#FAF7F2]/90 backdrop-blur-md border-b border-[#E5DFD5] px-4 sm:px-6 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EDE5DB] border border-[#DDD3C6] flex items-center justify-center text-[#55483B] shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">我的手账</h1>
              <p className="text-[11px] opacity-75">一个事件 · 一本独立手账 · 本地私密保存</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-open-settings"
              onClick={onOpenSettings}
              className="w-9 h-9 rounded-xl bg-white/80 hover:bg-white border border-[#DDD4C7] text-[#4A3F35] flex items-center justify-center transition-all active:scale-95 shadow-2xs"
              title="应用设置与备份管理"
              aria-label="设置"
            >
              <Settings className="w-4 h-4 text-[#7D6F61]" />
            </button>

            <button
              type="button"
              id="btn-open-create-notebook"
              onClick={() => setIsCreateModalOpen(true)}
              className="w-9 h-9 rounded-xl bg-[#4A3F35] hover:bg-[#382F26] text-[#FAF8F5] flex items-center justify-center transition-all active:scale-95 shadow-sm"
              title="新建手账"
              aria-label="新建手账"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6">
        {notebooks.length === 0 ? (
          /* Empty State - strictly respecting prompt requirement: "第一次打开应该是空的'我的手账'，显示：'还没有手账' 以及 '+ 新建手账'" */
          <div className="py-20 px-4 flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#EBE3D8] border border-[#DDD4C7] flex items-center justify-center text-[#695B4C] mb-4 shadow-sm">
              <BookOpen className="w-8 h-8 opacity-75" />
            </div>
            <h2 className="text-lg font-semibold text-[#2D2721] mb-1.5">还没有手账</h2>
            <p className="text-sm text-[#7F7468] mb-6 leading-relaxed">
              为即将发生的一件事新建一本手账。比如一次旅行、一项购买研究或一次聚会，把文字、照片和视频随手贴在上面。
            </p>
            <button
              type="button"
              id="btn-empty-create-notebook"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4A3F35] hover:bg-[#382F26] text-white text-sm font-medium shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>新建第一本手账</span>
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between pb-3 pt-1">
              <span className="text-xs font-semibold text-[#827466] uppercase tracking-wider">
                手账架（{notebooks.length}本）
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
              {notebooks.map((nb) => (
                <NotebookCard
                  key={nb.id}
                  notebook={nb}
                  onOpen={onOpenNotebook}
                  onDeleteRequest={(target) => setNotebookToDelete(target)}
                  onExportRequest={(target) => setExportModalState({ isOpen: true, notebookId: target.id })}
                  onEditCoverRequest={(target) => setNotebookToEditCover(target)}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Create Notebook Modal */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            id="create-notebook-dialog"
            className="w-full max-w-sm bg-[#FAF8F5] rounded-2xl shadow-2xl border border-[#E3DDD4] p-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#EDE6DC]">
              <h3 className="text-base font-semibold text-[#2D2721] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#8C7A68]" />
                新建事件手账
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-[#8C827A] hover:text-[#2D2721] hover:bg-[#EFEAE4]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="pt-4 flex flex-col gap-4">
              <div>
                <label
                  htmlFor="notebook-title-input"
                  className="block text-xs font-medium text-[#6B6054] mb-1.5"
                >
                  这本手账关于什么事件？
                </label>
                <input
                  id="notebook-title-input"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="例如：苏州旅行、买电脑前研究、上海购物..."
                  autoFocus
                  maxLength={50}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDD3C6] bg-white text-sm text-[#2D2721] placeholder:text-[#A89E92] focus:outline-hidden focus:ring-2 focus:ring-[#615143]/20 focus:border-[#615143]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-[#5E544A] bg-[#ECE5DC] hover:bg-[#E2D9CE] rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  id="btn-confirm-create-notebook"
                  disabled={!newTitle.trim() || isSubmitting}
                  className="px-5 py-2 text-xs font-medium text-white bg-[#4A4036] hover:bg-[#383028] disabled:opacity-40 disabled:pointer-events-none rounded-xl transition-colors shadow-sm"
                >
                  {isSubmitting ? '创建中...' : '创建并翻开'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Notebook Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(notebookToDelete)}
        title="删除手账本"
        message={`确定要删除《${notebookToDelete?.title || ''}》吗？删除后其中的所有文字、照片和视频也会被永久删除，此操作无法恢复。`}
        confirmText="删除手账"
        cancelText="取消"
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setNotebookToDelete(null)}
      />

      {/* Export Notebook Modal */}
      <ExportModal
        isOpen={exportModalState.isOpen}
        initialNotebookId={exportModalState.notebookId}
        onClose={() => setExportModalState({ isOpen: false })}
        showToast={showToast}
      />

      {/* Edit Cover Modal */}
      <EditCoverModal
        isOpen={Boolean(notebookToEditCover)}
        notebook={notebookToEditCover}
        onSave={handleSaveCover}
        onClose={() => setNotebookToEditCover(null)}
        showToast={showToast}
      />
    </div>
  );
};
