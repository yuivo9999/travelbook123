import { Notebook, ContentItem, MediaRecord } from '../types';

const DB_NAME = 'DigitalNotebookDB';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Notebooks store
      if (!db.objectStoreNames.contains('notebooks')) {
        const notebookStore = db.createObjectStore('notebooks', { keyPath: 'id' });
        notebookStore.createIndex('createdAt', 'createdAt', { unique: false });
        notebookStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // 2. Items store
      if (!db.objectStoreNames.contains('items')) {
        const itemStore = db.createObjectStore('items', { keyPath: 'id' });
        itemStore.createIndex('notebookId', 'notebookId', { unique: false });
        itemStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 3. Media store (stores binary blobs)
      if (!db.objectStoreNames.contains('media')) {
        const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
        mediaStore.createIndex('notebookId', 'notebookId', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(new Error(`打开本地数据库失败: ${request.error?.message || '未知错误'}`));
    };
  });
}

// ----------------- Notebooks -----------------

export async function getAllNotebooks(): Promise<Notebook[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['notebooks', 'items'], 'readonly');
    const notebookStore = tx.objectStore('notebooks');
    const itemStore = tx.objectStore('items');
    const index = itemStore.index('notebookId');

    const notebooksRequest = notebookStore.getAll();

    notebooksRequest.onsuccess = async () => {
      const notebooks: Notebook[] = notebooksRequest.result || [];
      // Sort by updatedAt descending
      notebooks.sort((a, b) => b.updatedAt - a.updatedAt);

      // Populate item counts
      const countsPromises = notebooks.map((nb) => {
        return new Promise<number>((resCount) => {
          const countReq = index.count(IDBKeyRange.only(nb.id));
          countReq.onsuccess = () => resCount(countReq.result);
          countReq.onerror = () => resCount(0);
        });
      });

      const counts = await Promise.all(countsPromises);
      notebooks.forEach((nb, i) => {
        nb.itemCount = counts[i];
      });

      resolve(notebooks);
    };

    notebooksRequest.onerror = () => {
      reject(new Error('读取手账列表失败'));
    };
  });
}

export async function getNotebook(id: string): Promise<Notebook | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notebooks', 'readonly');
    const store = tx.objectStore('notebooks');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error('读取手账详情失败'));
  });
}

export async function saveNotebook(notebook: Notebook): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notebooks', 'readwrite');
    const store = tx.objectStore('notebooks');
    const request = store.put(notebook);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('保存手账失败'));
  });
}

export async function deleteNotebook(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['notebooks', 'items', 'media'], 'readwrite');
    const notebookStore = tx.objectStore('notebooks');
    const itemStore = tx.objectStore('items');
    const mediaStore = tx.objectStore('media');

    // 1. Delete notebook
    notebookStore.delete(id);

    // 2. Find and delete all items belonging to this notebook
    const itemsIndex = itemStore.index('notebookId');
    const itemsReq = itemsIndex.getAll(IDBKeyRange.only(id));

    itemsReq.onsuccess = () => {
      const items: ContentItem[] = itemsReq.result || [];
      items.forEach((item) => {
        itemStore.delete(item.id);
        if (item.mediaId) {
          mediaStore.delete(item.mediaId);
        }
      });

      // 3. Delete any orphaned media with notebookId
      const mediaIndex = mediaStore.index('notebookId');
      const mediaReq = mediaIndex.getAllKeys(IDBKeyRange.only(id));
      mediaReq.onsuccess = () => {
        const keys = mediaReq.result || [];
        keys.forEach((k) => mediaStore.delete(k));
      };
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('删除手账失败'));
  });
}

// ----------------- Items -----------------

export async function getItemsByNotebook(notebookId: string): Promise<ContentItem[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readonly');
    const store = tx.objectStore('items');
    const index = store.index('notebookId');
    const request = index.getAll(IDBKeyRange.only(notebookId));

    request.onsuccess = () => {
      const items: ContentItem[] = request.result || [];
      // Sort by zIndex, then createdAt
      items.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0) || a.createdAt - b.createdAt);
      resolve(items);
    };
    request.onerror = () => reject(new Error('读取手账内容失败'));
  });
}

export async function saveItem(item: ContentItem): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['items', 'notebooks'], 'readwrite');
    const itemStore = tx.objectStore('items');
    const notebookStore = tx.objectStore('notebooks');

    itemStore.put(item);

    // Update notebook updatedAt timestamp
    const nbReq = notebookStore.get(item.notebookId);
    nbReq.onsuccess = () => {
      if (nbReq.result) {
        const nb = nbReq.result as Notebook;
        nb.updatedAt = Date.now();
        notebookStore.put(nb);
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('保存内容项失败'));
  });
}

export async function updateItemPosition(
  id: string,
  x: number,
  y: number,
  zIndex: number
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readwrite');
    const store = tx.objectStore('items');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      if (getReq.result) {
        const item = getReq.result as ContentItem;
        item.x = Math.round(x);
        item.y = Math.round(y);
        item.zIndex = zIndex;
        item.updatedAt = Date.now();
        store.put(item);
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('更新内容位置失败'));
  });
}

export async function deleteItem(id: string, mediaId?: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['items', 'media'], 'readwrite');
    const itemStore = tx.objectStore('items');
    const mediaStore = tx.objectStore('media');

    itemStore.delete(id);
    if (mediaId) {
      mediaStore.delete(mediaId);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('删除内容失败'));
  });
}

// ----------------- Media -----------------

export async function saveMedia(media: MediaRecord): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media', 'readwrite');
    const store = tx.objectStore('media');
    const request = store.put(media);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('保存媒体数据失败'));
  });
}

export async function getMedia(id: string): Promise<MediaRecord | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media', 'readonly');
    const store = tx.objectStore('media');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error('读取媒体数据失败'));
  });
}

export async function deleteMedia(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media', 'readwrite');
    const store = tx.objectStore('media');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('删除媒体数据失败'));
  });
}

// ----------------- Stats & Maintenance -----------------

export async function getAllItems(): Promise<ContentItem[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readonly');
    const store = tx.objectStore('items');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error('读取所有内容项失败'));
  });
}

export async function getDatabaseStats(): Promise<{
  notebookCount: number;
  itemCount: number;
  mediaCount: number;
}> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['notebooks', 'items', 'media'], 'readonly');
    const nbStore = tx.objectStore('notebooks');
    const itemStore = tx.objectStore('items');
    const mediaStore = tx.objectStore('media');

    let nbCount = 0;
    let itemCount = 0;
    let mediaCount = 0;

    const nbReq = nbStore.count();
    nbReq.onsuccess = () => {
      nbCount = nbReq.result;
    };

    const itemReq = itemStore.count();
    itemReq.onsuccess = () => {
      itemCount = itemReq.result;
    };

    const mediaReq = mediaStore.count();
    mediaReq.onsuccess = () => {
      mediaCount = mediaReq.result;
    };

    tx.oncomplete = () => {
      resolve({
        notebookCount: nbCount,
        itemCount,
        mediaCount,
      });
    };

    tx.onerror = () => reject(new Error('获取存储统计数据失败'));
  });
}

export async function clearAllDatabaseData(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['notebooks', 'items', 'media'], 'readwrite');
    tx.objectStore('notebooks').clear();
    tx.objectStore('items').clear();
    tx.objectStore('media').clear();

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('清空手账数据失败'));
  });
}
