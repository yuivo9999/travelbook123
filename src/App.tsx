import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Notebook, AppSettings } from './types';
import { getAllNotebooks, saveNotebook, deleteNotebook, getNotebook } from './db/indexedDB';
import { NotebookShelf } from './components/NotebookShelf';
import { NotebookView } from './components/NotebookView';
import { ToastContainer, ToastMessage } from './components/common/Toast';
import { SettingsModal } from './components/modals/SettingsModal';
import { ImportModal } from './components/modals/ImportModal';
import { loadSettings, saveSettings, BACKGROUND_SKINS } from './utils/settings';
import { parseBackupFile, ScrapbookBackup } from './utils/exportImport';
import { Upload } from 'lucide-react';

export default function App() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [activeNotebook, setActiveNotebook] = useState<Notebook | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [isHomeImportOpen, setIsHomeImportOpen] = useState(false);
  const [homeImportBackup, setHomeImportBackup] = useState<ScrapbookBackup | null>(null);
  const [isHomeParsing, setIsHomeParsing] = useState(false);
  const homeImportInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((text: string, type: 'error' | 'success' | 'info' = 'info') => {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, text, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshNotebooks = useCallback(async () => {
    try {
      setLoading(true);
      const list = await getAllNotebooks();
      setNotebooks(list);
    } catch (err) {
      console.error(err);
      showToast('加载手账数据失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    refreshNotebooks();
  }, [refreshNotebooks]);

  useEffect(() => {
    if (!activeNotebookId) {
      setActiveNotebook(null);
      return;
    }
    async function fetchActive() {
      try {
        const nb = await getNotebook(activeNotebookId!);
        if (nb) setActiveNotebook(nb);
        else setActiveNotebookId(null);
      } catch (err) {
        console.error(err);
        showToast('未能打开指定手账', 'error');
        setActiveNotebookId(null);
      }
    }
    fetchActive();
  }, [activeNotebookId, showToast]);

  const handleUpdateSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    if (activeNotebook) {
      const updatedNb: Notebook = {
        ...activeNotebook,
        backgroundSkin: newSettings.backgroundSkin,
        paperPattern: newSettings.defaultPaperPattern,
        updatedAt: Date.now(),
      };
      setActiveNotebook(updatedNb);
      setNotebooks((prev) => prev.map((n) => (n.id === updatedNb.id ? updatedNb : n)));
      try { await saveNotebook(updatedNb); } catch (err) { console.error('更新手账样式失败', err); }
    }
  };

  const handleCreateNotebook = async (title: string): Promise<string> => {
    const newId = 'nb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newNotebook: Notebook = {
      id: newId, title, createdAt: Date.now(), updatedAt: Date.now(), itemCount: 0,
      paperPattern: settings.defaultPaperPattern, backgroundSkin: settings.backgroundSkin,
    };
    try {
      await saveNotebook(newNotebook);
      await refreshNotebooks();
      showToast(`已建立《${title}》手账`, 'success');
      return newId;
    } catch (err) {
      console.error(err);
      showToast('创建手账失败', 'error');
      throw err;
    }
  };

  const handleDeleteNotebook = async (id: string) => {
    try {
      await deleteNotebook(id);
      if (activeNotebookId === id) setActiveNotebookId(null);
      await refreshNotebooks();
      showToast('已删除手账及其所有资料', 'success');
    } catch (err) {
      console.error(err);
      showToast('删除手账失败', 'error');
    }
  };

  const handleUpdateNotebook = (updated: Notebook) => {
    setActiveNotebook(updated);
    setNotebooks((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  };

  const handleBackToShelf = () => {
    setActiveNotebookId(null);
    refreshNotebooks();
  };

  const handleHomeImportClick = () => {
    if (homeImportInputRef.current) homeImportInputRef.current.value = '';
    homeImportInputRef.current?.click();
  };

  const handleHomeImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      showToast('没有选择备份文件', 'info');
      return;
    }
    try {
      setIsHomeParsing(true);
      showToast(`正在读取备份：${file.name}`, 'info');
      const parsed = await parseBackupFile(file);
      setHomeImportBackup(parsed);
      setIsHomeImportOpen(true);
      showToast(`备份读取成功：${parsed.notebooks.length} 本手账，${parsed.items.length} 项内容`, 'success');
    } catch (err) {
      console.error('主页导入解析失败', err);
      showToast(err instanceof Error ? `导入解析失败：${err.message}` : '导入解析失败，请确认 ZIP 文件格式', 'error');
    } finally {
      setIsHomeParsing(false);
      if (homeImportInputRef.current) homeImportInputRef.current.value = '';
    }
  };

  const handleHomeImportSuccess = async () => {
    await refreshNotebooks();
    setActiveNotebookId(null);
    setActiveNotebook(null);
    setDataVersion((v) => v + 1);
  };

  const activeSkinId = activeNotebook?.backgroundSkin || settings.backgroundSkin;
  const currentSkinConfig = BACKGROUND_SKINS.find((s) => s.id === activeSkinId) || BACKGROUND_SKINS[0];

  return (
    <div className={`min-h-screen ${currentSkinConfig.bgClass} ${currentSkinConfig.textClass} transition-colors duration-300 selection:bg-[#E5D7C3] selection:text-[#2D2721]`}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <input ref={homeImportInputRef} type="file" accept=".zip,application/zip,application/x-zip-compressed" className="hidden" onChange={handleHomeImportFileChange} />

      {!activeNotebook && (
        <button
          type="button"
          id="btn-home-import-backup"
          onClick={handleHomeImportClick}
          disabled={isHomeParsing}
          className="fixed top-3 right-[5.75rem] z-[2000] w-9 h-9 rounded-xl bg-white/90 hover:bg-white border border-[#DDD4C7] text-[#4A3F35] flex items-center justify-center transition-all active:scale-95 shadow-sm disabled:opacity-60"
          title="导入存档"
          aria-label="导入存档"
        >
          <Upload className="w-4 h-4 text-[#7D6F61]" />
        </button>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onClose={() => setIsSettingsOpen(false)}
        onDataReset={() => { setActiveNotebookId(null); refreshNotebooks(); }}
        onDataImported={() => { refreshNotebooks(); setDataVersion((v) => v + 1); }}
        showToast={showToast}
      />

      <ImportModal
        isOpen={isHomeImportOpen}
        backup={homeImportBackup}
        onClose={() => { if (!isHomeParsing) setIsHomeImportOpen(false); }}
        onImportSuccess={handleHomeImportSuccess}
        showToast={showToast}
      />

      {activeNotebook ? (
        <NotebookView
          key={`${activeNotebook.id}_v${dataVersion}`}
          notebook={activeNotebook}
          settings={settings}
          onBack={handleBackToShelf}
          onUpdateNotebook={handleUpdateNotebook}
          onOpenSettings={() => setIsSettingsOpen(true)}
          showToast={showToast}
        />
      ) : (
        <NotebookShelf
          notebooks={notebooks}
          onCreateNotebook={handleCreateNotebook}
          onOpenNotebook={(id) => setActiveNotebookId(id)}
          onDeleteNotebook={handleDeleteNotebook}
          onOpenSettings={() => setIsSettingsOpen(true)}
          showToast={showToast}
        />
      )}
    </div>
  );
}
