import React, { useState, useEffect, useCallback } from 'react';
import { Notebook } from './types';
import {
  getAllNotebooks,
  saveNotebook,
  deleteNotebook,
  getNotebook,
} from './db/indexedDB';
import { NotebookShelf } from './components/NotebookShelf';
import { NotebookView } from './components/NotebookView';
import { ToastContainer, ToastMessage } from './components/common/Toast';

export default function App() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [activeNotebook, setActiveNotebook] = useState<Notebook | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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
      paperPattern: 'dots',
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

  return (
    <div className="min-h-screen bg-[#F4EFEA] text-[#2D2721] selection:bg-[#E5D7C3] selection:text-[#2D2721]">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {activeNotebook ? (
        <NotebookView
          notebook={activeNotebook}
          onBack={handleBackToShelf}
          onUpdateNotebook={handleUpdateNotebook}
          showToast={showToast}
        />
      ) : (
        <NotebookShelf
          notebooks={notebooks}
          onCreateNotebook={handleCreateNotebook}
          onOpenNotebook={(id) => setActiveNotebookId(id)}
          onDeleteNotebook={handleDeleteNotebook}
        />
      )}
    </div>
  );
}
