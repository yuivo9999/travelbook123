import { Notebook, ContentItem, MediaRecord } from '../types';

const LS_KEY_NOTEBOOKS = 'digital_notebooks_v3';
const LS_KEY_ITEMS = 'digital_items_v3';
const LS_KEY_MEDIA = 'digital_media_v3';

// In-memory cache for ultra-fast, zero-latency synchronous access
let notebooksCache: Notebook[] | null = null;
let itemsCache: Map<string, ContentItem> | null = null;
let mediaCache: Map<string, MediaRecord> | null = null;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, fallbackType = 'image/jpeg'): Blob {
  try {
    if (!base64 || !base64.startsWith('data:')) {
      return new Blob([], { type: fallbackType });
    }
    const parts = base64.split(';base64,');
    const contentType = parts[0]?.replace('data:', '') || fallbackType;
    const raw = atob(parts[1] || parts[0]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  } catch {
    return new Blob([], { type: fallbackType });
  }
}

// Load data from localStorage into memory cache on first access (pure synchronous)
function loadCacheFromLS(): void {
  if (notebooksCache && itemsCache && mediaCache) return;

  notebooksCache = [];
  itemsCache = new Map();
  mediaCache = new Map();

  try {
    const nbStr = localStorage.getItem(LS_KEY_NOTEBOOKS);
    if (nbStr) {
      notebooksCache = JSON.parse(nbStr);
    }

    const itemStr = localStorage.getItem(LS_KEY_ITEMS);
    if (itemStr) {
      const parsedItems: ContentItem[] = JSON.parse(itemStr);
      parsedItems.forEach((it) => itemsCache!.set(it.id, it));
    }

    const mediaStr = localStorage.getItem(LS_KEY_MEDIA);
    if (mediaStr) {
      const parsedMedia: any[] = JSON.parse(mediaStr);
      parsedMedia.forEach((m) => {
        const record: MediaRecord = {
          ...m,
          blob: m.blob || undefined,
          thumbnailBlob: m.thumbDataUrl ? base64ToBlob(m.thumbDataUrl, 'image/jpeg') : m.thumbnailBlob,
        };
        mediaCache!.set(m.id, record);
      });
    }
  } catch (err) {
    console.warn('Failed to load storage from localStorage:', err);
  }

  // Create default notebook if empty
  if (notebooksCache.length === 0) {
    const defaultNb: Notebook = {
      id: 'default-notebook-1',
      title: '我的第一个随手记手账',
      coverType: 'none',
      coverColor: '#D9C8B4',
      itemCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    notebooksCache.push(defaultNb);
    persistNotebooksLS();
  }
}

// Persistence helpers
function persistNotebooksLS(): void {
  if (!notebooksCache) return;
  try {
    localStorage.setItem(LS_KEY_NOTEBOOKS, JSON.stringify(notebooksCache));
  } catch {
    // ignore
  }
}

function persistItemsLS(): void {
  if (!itemsCache) return;
  try {
    const arr = Array.from(itemsCache.values());
    localStorage.setItem(LS_KEY_ITEMS, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

async function persistMediaLS(): Promise<void> {
  if (!mediaCache) return;
  const arr = Array.from(mediaCache.values());

  const serializedPromises = arr.map(async (m) => {
    let thumbDataUrl: string | undefined;

    // Only encode base64 for small thumbnail images (< 150KB)
    if (m.thumbnailBlob instanceof Blob && m.thumbnailBlob.size < 150000) {
      try {
        thumbDataUrl = await blobToBase64(m.thumbnailBlob);
      } catch {
        thumbDataUrl = undefined;
      }
    }

    return {
      id: m.id,
      notebookId: m.notebookId,
      type: m.type,
      mimeType: m.mimeType,
      width: m.width,
      height: m.height,
      duration: m.duration,
      fileName: m.fileName,
      sourceUrl: m.sourceUrl,
      fileSize: m.fileSize,
      createdAt: m.createdAt,
      thumbDataUrl,
    };
  });

  try {
    const serialized = await Promise.all(serializedPromises);
    localStorage.setItem(LS_KEY_MEDIA, JSON.stringify(serialized));
  } catch {
    // ignore
  }
}

// Backward compatibility stub (pure synchronous resolve)
export async function openDatabase(): Promise<any> {
  loadCacheFromLS();
  return null;
}

// ----------------- Notebooks -----------------

export async function getAllNotebooks(): Promise<Notebook[]> {
  loadCacheFromLS();
  const notebooks = [...notebooksCache!];
  notebooks.sort((a, b) => b.updatedAt - a.updatedAt);

  // Recalculate item counts
  const items = Array.from(itemsCache!.values());
  notebooks.forEach((nb) => {
    nb.itemCount = items.filter((i) => i.notebookId === nb.id).length;
  });

  return notebooks;
}

export async function getNotebook(id: string): Promise<Notebook | null> {
  loadCacheFromLS();
  const nb = notebooksCache!.find((n) => n.id === id);
  return nb ? { ...nb } : null;
}

export async function saveNotebook(notebook: Notebook): Promise<void> {
  loadCacheFromLS();
  const idx = notebooksCache!.findIndex((n) => n.id === notebook.id);
  if (idx >= 0) {
    notebooksCache![idx] = { ...notebook, updatedAt: Date.now() };
  } else {
    notebooksCache!.push({ ...notebook });
  }
  persistNotebooksLS();
}

export async function deleteNotebook(id: string): Promise<void> {
  loadCacheFromLS();
  notebooksCache = notebooksCache!.filter((n) => n.id !== id);
  persistNotebooksLS();

  // Remove items in this notebook
  const itemEntries = Array.from(itemsCache!.entries());
  for (const [itemId, item] of itemEntries) {
    if (item.notebookId === id) {
      itemsCache!.delete(itemId);
      if (item.mediaId) {
        mediaCache!.delete(item.mediaId);
      }
    }
  }
  persistItemsLS();
  persistMediaLS();
}

// ----------------- Items -----------------

export async function getItemsByNotebook(notebookId: string): Promise<ContentItem[]> {
  loadCacheFromLS();
  const all = Array.from(itemsCache!.values()).filter((i) => i.notebookId === notebookId);
  all.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0) || a.createdAt - b.createdAt);
  return all;
}

export async function saveItem(item: ContentItem): Promise<void> {
  loadCacheFromLS();
  itemsCache!.set(item.id, { ...item, updatedAt: Date.now() });
  persistItemsLS();

  // Update notebook updatedAt
  const nb = notebooksCache!.find((n) => n.id === item.notebookId);
  if (nb) {
    nb.updatedAt = Date.now();
    nb.itemCount = Array.from(itemsCache!.values()).filter((i) => i.notebookId === item.notebookId).length;
    persistNotebooksLS();
  }
}

export async function updateItemPosition(
  id: string,
  x: number,
  y: number,
  zIndex: number
): Promise<void> {
  loadCacheFromLS();
  const item = itemsCache!.get(id);
  if (item) {
    item.x = Math.round(x);
    item.y = Math.round(y);
    item.zIndex = zIndex;
    item.updatedAt = Date.now();
    itemsCache!.set(id, item);
    persistItemsLS();
  }
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
  loadCacheFromLS();
  const item = itemsCache!.get(id);
  if (item) {
    if (transform.x !== undefined) item.x = Math.round(transform.x);
    if (transform.y !== undefined) item.y = Math.round(transform.y);
    if (transform.width !== undefined) item.width = Math.round(transform.width);
    if (transform.height !== undefined) item.height = Math.round(transform.height);
    if (transform.rotation !== undefined) item.rotation = Math.round(transform.rotation * 10) / 10;
    if (transform.zIndex !== undefined) item.zIndex = transform.zIndex;
    item.updatedAt = Date.now();
    itemsCache!.set(id, item);
    persistItemsLS();
  }
}

export async function deleteItem(id: string, mediaId?: string): Promise<void> {
  loadCacheFromLS();
  const item = itemsCache!.get(id);
  itemsCache!.delete(id);
  if (mediaId) {
    mediaCache!.delete(mediaId);
  }
  persistItemsLS();
  persistMediaLS();

  if (item) {
    const nb = notebooksCache!.find((n) => n.id === item.notebookId);
    if (nb) {
      nb.updatedAt = Date.now();
      nb.itemCount = Array.from(itemsCache!.values()).filter((i) => i.notebookId === item.notebookId).length;
      persistNotebooksLS();
    }
  }
}

// ----------------- Media -----------------

export async function saveMedia(media: MediaRecord): Promise<void> {
  loadCacheFromLS();
  mediaCache!.set(media.id, { ...media });
  persistMediaLS(); // Non-blocking fire and forget
}

export async function updateMediaSource(
  id: string,
  update: { fileHandle?: any; sourceUrl?: string; fileName?: string }
): Promise<void> {
  loadCacheFromLS();
  const m = mediaCache!.get(id);
  if (m) {
    if (update.fileHandle !== undefined) m.fileHandle = update.fileHandle;
    if (update.sourceUrl !== undefined) m.sourceUrl = update.sourceUrl;
    if (update.fileName !== undefined) m.fileName = update.fileName;
    mediaCache!.set(id, m);
    persistMediaLS();
  }
}

export async function getMedia(id: string): Promise<MediaRecord | null> {
  loadCacheFromLS();
  const m = mediaCache!.get(id);
  return m ? { ...m } : null;
}

export async function deleteMedia(id: string): Promise<void> {
  loadCacheFromLS();
  mediaCache!.delete(id);
  persistMediaLS();
}

// ----------------- Stats & Maintenance -----------------

export async function getAllItems(): Promise<ContentItem[]> {
  loadCacheFromLS();
  return Array.from(itemsCache!.values());
}

export async function getDatabaseStats(): Promise<{
  notebookCount: number;
  itemCount: number;
  mediaCount: number;
}> {
  loadCacheFromLS();
  return {
    notebookCount: notebooksCache!.length,
    itemCount: itemsCache!.size,
    mediaCount: mediaCache!.size,
  };
}

export async function clearAllDatabaseData(): Promise<void> {
  notebooksCache = [];
  itemsCache = new Map();
  mediaCache = new Map();
  try {
    localStorage.removeItem(LS_KEY_NOTEBOOKS);
    localStorage.removeItem(LS_KEY_ITEMS);
    localStorage.removeItem(LS_KEY_MEDIA);
  } catch {
    // ignore
  }
}
