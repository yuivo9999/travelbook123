import { Notebook, ContentItem, MediaRecord } from '../types';
import { deleteOriginalMedia, writeOriginalMedia, getMediaStorageKey, canKeepLegacyInlineMedia } from '../utils/mediaStorage';

const DB_NAME = 'DigitalNotebookDB';
const DB_VERSION = 2;

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
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      dbInstance.onclose = () => {
        dbInstance = null;
      };
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
  const items = await getItemsByNotebook(id);
  const mediaIds = Array.from(new Set(items.map((item) => item.mediaId).filter((v): v is string => Boolean(v))));
  await Promise.all(mediaIds.map((mediaId) => deleteOriginalMedia(mediaId)));

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['notebooks', 'items', 'media'], 'readwrite');
    tx.objectStore('notebooks').delete(id);
    const itemStore = tx.objectStore('items');
    const mediaStore = tx.objectStore('media');
    const itemsIndex = itemStore.index('notebookId');
    const itemsReq = itemsIndex.getAll(IDBKeyRange.only(id));
    itemsReq.onsuccess = () => {
      const storedItems: ContentItem[] = itemsReq.result || [];
      storedItems.forEach((item) => {
        itemStore.delete(item.id);
        if (item.mediaId) mediaStore.delete(item.mediaId);
      });
      const mediaIndex = mediaStore.index('notebookId');
      const mediaReq = mediaIndex.getAllKeys(IDBKeyRange.only(id));
      mediaReq.onsuccess = () => {
        for (const key of mediaReq.result || []) mediaStore.delete(key);
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

export async function updateItemTransform(
  id: string,
  transform: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    zIndex?: number;
  }
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readwrite');
    const store = tx.objectStore('items');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      if (getReq.result) {
        const item = getReq.result as ContentItem;
        if (transform.x !== undefined) item.x = Math.round(transform.x);
        if (transform.y !== undefined) item.y = Math.round(transform.y);
        if (transform.width !== undefined) item.width = Math.round(transform.width);
        if (transform.height !== undefined) item.height = Math.round(transform.height);
        if (transform.rotation !== undefined) item.rotation = Math.round(transform.rotation * 10) / 10;
        if (transform.zIndex !== undefined) item.zIndex = transform.zIndex;
        item.updatedAt = Date.now();
        store.put(item);
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('更新内容变形失败'));
  });
}

export async function deleteItem(id: string, mediaId?: string): Promise<void> {
  if (mediaId) await deleteOriginalMedia(mediaId);
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['items', 'media'], 'readwrite');
    tx.objectStore('items').delete(id);
    if (mediaId) tx.objectStore('media').delete(mediaId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('删除内容失败'));
  });
}

// ----------------- Media -----------------

export async function saveMedia(media: MediaRecord): Promise<void> {
  const db = await openDatabase();
  let storageKey = media.storageKey;
  let legacyBlob: Blob | undefined;

  // New rule: originals go to OPFS, not an IndexedDB record.
  if (media.blob instanceof Blob && media.blob.size > 0) {
    storageKey = await writeOriginalMedia(media.id, media.blob);
    // If OPFS is unavailable, retain the blob as a compatibility fallback.
    if (!storageKey) {
      if (!canKeepLegacyInlineMedia(media.blob)) {
        throw new Error('当前浏览器不支持 OPFS，无法安全保存超过 4MB 的原始媒体文件。请使用支持现代文件存储的浏览器。');
      }
      legacyBlob = media.blob;
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('media', 'readwrite');
      const store = tx.objectStore('media');
      const cleanThumb = media.thumbnailBlob instanceof Blob
        ? media.thumbnailBlob.slice(0, media.thumbnailBlob.size, media.thumbnailBlob.type || 'image/jpeg')
        : media.thumbnailBlob;

      const cleanRecord: MediaRecord = {
        id: media.id,
        notebookId: media.notebookId,
        type: media.type,
        mimeType: media.mimeType,
        blob: legacyBlob,
        thumbnailBlob: cleanThumb,
        storageKey: storageKey || getMediaStorageKey(media.id),
        width: media.width,
        height: media.height,
        duration: media.duration,
        fileName: media.fileName,
        sourceUrl: media.sourceUrl,
        // Deliberately do not persist FileSystemFileHandle as a core storage dependency.
        fileSize: media.fileSize ?? media.blob?.size,
        createdAt: media.createdAt || Date.now(),
      };

      const request = store.put(cleanRecord);
      request.onerror = () => reject(new Error(`保存媒体元数据失败: ${request.error?.message || '未知错误'}`));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error(`保存媒体事务失败: ${tx.error?.message || '存储空间不足或格式受限'}`));
      tx.onabort = () => reject(new Error(`保存媒体被中止: ${tx.error?.message || '浏览器存储配额受限'}`));
    } catch (err) {
      reject(err instanceof Error ? err : new Error('保存媒体数据异常'));
    }
  });
}

export async function updateMediaSource(
  id: string,
  update: { fileHandle?: any; sourceUrl?: string; fileName?: string; file?: Blob; fileSize?: number }
): Promise<void> {
  const db = await openDatabase();
  const existing = await new Promise<MediaRecord | null>((resolve, reject) => {
    const tx = db.transaction('media', 'readonly');
    const req = tx.objectStore('media').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(new Error('读取媒体信息失败'));
  });
  if (!existing) throw new Error('媒体记录不存在');

  if (update.file && update.file.size > 0) {
    const storageKey = await writeOriginalMedia(id, update.file);
    if (!storageKey) {
      if (!canKeepLegacyInlineMedia(update.file)) {
        throw new Error('当前浏览器不支持 OPFS，无法安全重新保存超过 4MB 的原始媒体文件。');
      }
      // OPFS unavailable: compatibility fallback only.
      existing.blob = update.file;
    } else {
      existing.blob = undefined;
      existing.storageKey = storageKey;
    }
    existing.fileSize = update.fileSize ?? update.file.size;
  }
  if (update.sourceUrl !== undefined) existing.sourceUrl = update.sourceUrl;
  if (update.fileName !== undefined) existing.fileName = update.fileName;
  existing.fileHandle = undefined;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('media', 'readwrite');
    const req = tx.objectStore('media').put(existing);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(new Error('更新媒体信息失败'));
  });
}

export async function getMedia(id: string): Promise<MediaRecord | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('media', 'readonly');
      const request = tx.objectStore('media').get(id);
      request.onsuccess = async () => {
        const result = request.result as MediaRecord | undefined;
        if (!result) { resolve(null); return; }
        // Lazy migration for records from Stage 0/1 that still contain a full Blob.
        if (result.blob instanceof Blob && result.blob.size > 0 && !result.storageKey) {
          try {
            const storageKey = await writeOriginalMedia(result.id, result.blob);
            if (storageKey) {
              result.storageKey = storageKey;
              result.blob = undefined;
              result.fileHandle = undefined;
              const migrationTx = db.transaction('media', 'readwrite');
              migrationTx.objectStore('media').put(result);
            }
          } catch { /* keep legacy blob in memory for this read */ }
        }
        resolve(result);
      };
      request.onerror = () => reject(new Error('读取媒体数据失败'));
    } catch (err) {
      console.error('IndexedDB getMedia exception:', err);
      resolve(null);
    }
  });
}

export async function deleteMedia(id: string): Promise<void> {
  await deleteOriginalMedia(id);
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
