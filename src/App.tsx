import React, { useState, useEffect, useCallback } from 'react';
import { Notebook, AppSettings } from './types';
import {
  getAllNotebooks,
  saveNotebook,
  deleteNotebook,
  getNotebook,
} from './db/indexedDB';
import { NotebookShelf } from './components/NotebookShelf';
import { NotebookView } from './components/NotebookView';
import { ToastContainer, ToastMessage } from './components/common/Toast';
import { SettingsModal } from './components/modals/SettingsModal';
import { loadSettings, saveSettings, BACKGROUND_SKINS } from './utils/settings';

export default function App() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [activeNotebook, setActiveNotebook] = useState<Notebook | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const showToast = useCallback(
    (text: string, type: 'error' | 'success' | 'info' = 'info') => {
      const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      setToasts((prev) => [...prev, { id, text, type }]);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // Fetch all notebooks
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

  // Load active notebook whenever activeNotebookId changes
  useEffect(() => {
    if (!activeNotebookId) {
      setActiveNotebook(null);
      return;
    }

    async function fetchActive() {
      try {
        const nb = await getNotebook(activeNotebookId!);
        if (nb) {
          setActiveNotebook(nb);
        } else {
          setActiveNotebookId(null);
        }
      } catch (err) {
        console.error(err);
        showToast('未能打开指定手账', 'error');
        setActiveNotebookId(null);
      }
    }

    fetchActive();
  }, [activeNotebookId, showToast]);

  // Create a new notebook
  const handleCreateNotebook = async (title: string): Promise<string> => {
    const newId = 'nb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newNotebook: Notebook = {
      id: newId,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      itemCount: 0,
      paperPattern: settings.defaultPaperPattern,
      backgroundSkin: settings.backgroundSkin,
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

  // Delete a notebook
  const handleDeleteNotebook = async (id: string) => {
    try {
      await deleteNotebook(id);
      if (activeNotebookId === id) {
        setActiveNotebookId(null);
      }
      await refreshNotebooks();
      showToast('已删除手账及其所有资料', 'success');
    } catch (err) {
      console.error(err);
      showToast('删除手账失败', 'error');
    }
  };

  // Update notebook metadata (e.g. title or paper pattern)
  const handleUpdateNotebook = (updated: Notebook) => {
    setActiveNotebook(updated);
    setNotebooks((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  };

  // Return to shelf
  const handleBackToShelf = () => {
    setActiveNotebookId(null);
    refreshNotebooks();
  };

  // Active background skin resolution
  const activeSkinId = activeNotebook?.backgroundSkin || settings.backgroundSkin;
  const currentSkinConfig =
    BACKGROUND_SKINS.find((s) => s.id === activeSkinId) || BACKGROUND_SKINS[0];

  return (
    <div
      className={`min-h-screen ${currentSkinConfig.bgClass} ${currentSkinConfig.textClass} transition-colors duration-300 selection:bg-[#E5D7C3] selection:text-[#2D2721]`}
    >
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onClose={() => setIsSettingsOpen(false)}
        onDataReset={() => {
          setActiveNotebookId(null);
          refreshNotebooks();
        }}
        onDataImported={() => {
          refreshNotebooks();
        }}
        showToast={showToast}
      />

      {activeNotebook ? (
        <NotebookView
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
