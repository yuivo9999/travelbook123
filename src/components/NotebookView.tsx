import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Plus,
  Grid,
  Edit2,
  Trash2,
  Sparkles,
  Layers,
  ChevronDown,
  Settings,
  Image as ImageIcon,
  Video as VideoIcon,
  Film,
  Type,
  Upload,
  Download,
} from 'lucide-react';
import { Notebook, ContentItem, MediaRecord } from '../types';
import { ExportModal } from './modals/ExportModal';
import {
  getItemsByNotebook,
  saveItem,
  updateItemPosition,
  updateItemTransform,
  deleteItem,
  saveMedia,
  saveNotebook,
} from '../db/indexedDB';
import { playMechanicalTick } from '../utils/rotationSound';
import { processImageFile, processVideoFile, registerSessionFile } from '../utils/media';

function inferMimeType(file: File, defaultType: string): string {
  if (file.type && file.type.trim().length > 0) return file.type;
  const name = file.name || '';
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'bmp') return 'image/bmp';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'm4v') return 'video/mp4';
  if (ext === 'ogv') return 'video/ogg';
  return defaultType;
}
import { TextItem } from './items/TextItem';
import { ImageItem } from './items/ImageItem';
import { VideoItem } from './items/VideoItem';
import { AddContentModal } from './modals/AddContentModal';
import { ImageViewerModal } from './modals/ImageViewerModal';
import { VideoPlayerModal } from './modals/VideoPlayerModal';
import { ConfirmDialog } from './modals/ConfirmDialog';
import { EditCoverModal } from './modals/EditCoverModal';
import { PaperStyle, AppSettings } from '../types';
import { PAPER_PATTERNS } from '../utils/settings';

interface NotebookViewProps {
  notebook: Notebook;
  settings: AppSettings;
  onBack: () => void;
  onUpdateNotebook: (updated: Notebook) => void;
  onOpenSettings: () => void;
  showToast: (text: string, type?: 'error' | 'success' | 'info') => void;
}

export const NotebookView: React.FC<NotebookViewProps> = ({
  notebook,
  settings,
  onBack,
  onUpdateNotebook,
  onOpenSettings,
  showToast,
}) => {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);
  const [previewImageId, setPreviewImageId] = useState<string | null>(null);
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; mediaId?: string } | null>(null);

  // Rename modal
  const [isRenaming, setIsRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(notebook.title);

  // Paper pattern: dots, grid, lines, blank, craft, textured
  const [paperPattern, setPaperPattern] = useState<PaperStyle>(
    notebook.paperPattern || settings.defaultPaperPattern || 'dots'
  );

  // Synchronize paper pattern when notebook or default settings change
  useEffect(() => {
    if (notebook.paperPattern) {
      setPaperPattern(notebook.paperPattern);
    } else if (settings.defaultPaperPattern) {
      setPaperPattern(settings.defaultPaperPattern);
    }
  }, [notebook.paperPattern, settings.defaultPaperPattern]);

  // Drag-and-drop file upload state onto paper canvas
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Canvas layout measurement
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(window.innerWidth);

  // Hidden file inputs for direct one-click uploading
  const directImageInputRef = useRef<HTMLInputElement>(null);
  const directVideoInputRef = useRef<HTMLInputElement>(null);

  // Track max zIndex
  const maxZIndexRef = useRef(10);

  // Dragging interaction state
  const draggingRef = useRef<{
    itemId: string;
    startX: number;
    startY: number;
    initialItemX: number;
    initialItemY: number;
    pointerId: number;
    hasMoved: boolean;
  } | null>(null);

  // Rotating interaction state
  const rotatingRef = useRef<{
    itemId: string;
    cx: number;
    cy: number;
    startAngle: number;
    initialRotation: number;
    pointerId: number;
    lastTickAngle: number;
    hasRotated: boolean;
  } | null>(null);

  // Resizing interaction state (for customizable sticky notes)
  const resizingRef = useRef<{
    itemId: string;
    startX: number;
    startY: number;
    initialWidth: number;
    initialHeight: number;
    rotationRad: number;
    pointerId: number;
    hasResized: boolean;
  } | null>(null);

  // Load items from IndexedDB
  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const loaded = await getItemsByNotebook(notebook.id);
      setItems(loaded);
      if (loaded.length > 0) {
        const highestZ = Math.max(...loaded.map((i) => i.zIndex || 1), 10);
        maxZIndexRef.current = highestZ + 1;
      }
    } catch (err) {
      console.error(err);
      showToast('加载手账内容失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [notebook.id, showToast]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Prevent browser default file open behavior across the entire window
  useEffect(() => {
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventDefaults);
    window.addEventListener('drop', preventDefaults);
    return () => {
      window.removeEventListener('dragover', preventDefaults);
      window.removeEventListener('drop', preventDefaults);
    };
  }, []);

  // Monitor canvas width for responsive bounds
  useEffect(() => {
    const updateWidth = () => {
      if (canvasRef.current) {
        setCanvasWidth(canvasRef.current.clientWidth);
      } else {
        setCanvasWidth(window.innerWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Forward refs for media handlers to guarantee fresh closures inside global event listeners
  const handleAddImageRef = useRef<(file: File) => Promise<void>>(() => Promise.resolve());
  const handleAddVideoRef = useRef<(file: File) => Promise<void>>(() => Promise.resolve());

  // Global paste handler for pasting screenshots, copied photos or video files
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      // Check clipboard files first (from OS file manager or screenshot tools)
      const files = Array.from(e.clipboardData?.files || []);
      if (files.length > 0) {
        let hasMedia = false;
        for (const file of files) {
          const mime = inferMimeType(file, '');
          if (mime.startsWith('image/') || file.type.startsWith('image/')) {
            hasMedia = true;
            e.preventDefault();
            await handleAddImageRef.current(file);
          } else if (mime.startsWith('video/') || file.type.startsWith('video/')) {
            hasMedia = true;
            e.preventDefault();
            await handleAddVideoRef.current(file);
          }
        }
        if (hasMedia) return;
      }

      // Check clipboard items (standard browser clipboard image/video copy)
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            await handleAddImageRef.current(file);
            return;
          }
        } else if (item.type.startsWith('video/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            await handleAddVideoRef.current(file);
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Update paper pattern
  const handlePatternChange = async (pattern: PaperStyle) => {
    setPaperPattern(pattern);
    const updated = { ...notebook, paperPattern: pattern, updatedAt: Date.now() };
    await saveNotebook(updated);
    onUpdateNotebook(updated);
  };

  // Rename title
  const handleSaveTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleDraft.trim()) return;
    const updated = { ...notebook, title: titleDraft.trim(), updatedAt: Date.now() };
    await saveNotebook(updated);
    onUpdateNotebook(updated);
    setIsRenaming(false);
    showToast('手账名称已更新', 'success');
  };

  // Calculate dynamic paper canvas height:
  // "手账 Canvas / Paper 的高度应该根据内容的最大 Y 坐标自动扩展。例如：某个内容在 y = 1500px，那么整体高度必须至少延伸到那里。"
  const calculateCanvasHeight = () => {
    const minHeight = typeof window !== 'undefined' ? window.innerHeight - 80 : 800;
    if (items.length === 0) return minHeight;

    const maxBottom = Math.max(
      ...items.map((it) => it.y + (it.height || 220))
    );
    return Math.max(minHeight, maxBottom + 350);
  };

  // Determine spawn coordinates for newly added items
  const getNextSpawnCoordinates = (itemWidth = 260, itemHeight = 180) => {
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const padding = 16;
    const maxAvailableWidth = Math.max(280, canvasWidth - itemWidth - padding);

    // If there are existing items, place in the currently visible viewport or below recent item
    const baseTop = Math.max(30, scrollY + 80);

    // Stagger X organically
    const randomXOffset = (items.length % 2 === 0 ? 1 : -1) * (15 + (items.length * 12) % 40);
    const centerX = (canvasWidth - itemWidth) / 2 + randomXOffset;
    const clampedX = Math.max(padding, Math.min(maxAvailableWidth, centerX));

    // Stagger Y slightly if overlapping
    const clampedY = baseTop + ((items.length * 35) % 180);

    // Organic rotation between -2 and +2 degrees
    const rotations = [-1.5, 1, -0.8, 1.8, -1.2, 0.5, -2, 1.5];
    const rotation = rotations[items.length % rotations.length];

    return { x: Math.round(clampedX), y: Math.round(clampedY), rotation };
  };

  // 1. Add text item
  const handleAddText = async (
    text: string,
    noteColor: 'yellow' | 'white' | 'blue' | 'pink' | 'kraft'
  ) => {
    try {
      const { x, y, rotation } = getNextSpawnCoordinates(260, 160);
      const newZ = ++maxZIndexRef.current;

      const newItem: ContentItem = {
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        notebookId: notebook.id,
        type: 'text',
        text,
        noteColor,
        x,
        y,
        width: 260,
        height: 160,
        rotation,
        zIndex: newZ,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveItem(newItem);
      setItems((prev) => [...prev, newItem]);
      showToast('已贴上手账便签', 'success');

      // Scroll smoothly to newly added item if below screen
      if (y > window.scrollY + window.innerHeight - 200) {
        window.scrollTo({ top: y - 100, behavior: 'smooth' });
      }
    } catch (err) {
      console.error(err);
      showToast('添加便签失败', 'error');
    }
  };

  // 2. Add image item (Lightweight: only saves thumbnail in DB, accesses original file on click)
  const handleAddImage = async (file: File, fileHandle?: any) => {
    try {
      showToast('正在生成缩略图并贴入手账...', 'info');
      const mime = inferMimeType(file, 'image/jpeg');
      const { thumbnailBlob, width, height } = await processImageFile(file);

      const mediaId = 'media_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      registerSessionFile(mediaId, file);

      const mediaRecord: MediaRecord = {
        id: mediaId,
        notebookId: notebook.id,
        type: 'image',
        mimeType: mime,
        thumbnailBlob,
        width,
        height,
        fileName: file.name || 'image.jpg',
        sourceUrl: file.name || 'local_image',
        fileHandle: fileHandle || undefined,
        fileSize: file.size,
        createdAt: Date.now(),
      };

      await saveMedia(mediaRecord);

      // Compute display dimensions for scrapbook card
      const cardWidth = Math.min(260, canvasWidth - 32);
      const cardHeight = Math.round((cardWidth * (height || 200)) / (width || 260)) + 60;

      const { x, y, rotation } = getNextSpawnCoordinates(cardWidth, cardHeight);
      const newZ = ++maxZIndexRef.current;

      const newItem: ContentItem = {
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        notebookId: notebook.id,
        type: 'image',
        mediaId,
        fileName: file.name,
        sourceUrl: file.name,
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        rotation,
        zIndex: newZ,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveItem(newItem);
      setItems((prev) => [...prev, newItem]);

      // If notebook doesn't have a cover yet, set this image as cover
      if (!notebook.coverImageId) {
        const updated = { ...notebook, coverImageId: mediaId, updatedAt: Date.now() };
        await saveNotebook(updated);
        onUpdateNotebook(updated);
      }

      showToast('已成功贴上照片 (轻量化存储)', 'success');

      if (y > window.scrollY + window.innerHeight - 200) {
        window.scrollTo({ top: y - 100, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('添加图片失败', err);
      showToast(err instanceof Error ? err.message : '添加图片失败', 'error');
    }
  };
  handleAddImageRef.current = handleAddImage;

  // 3. Add video item (Lightweight: only saves frame thumbnail in DB, accesses original video on play)
  const handleAddVideo = async (file: File, fileHandle?: any) => {
    try {
      showToast('正在提取视频封面并生成手账卡片...', 'info');
      const mime = inferMimeType(file, 'video/mp4');
      const { thumbnailBlob, duration, width, height } = await processVideoFile(file);

      const mediaId = 'media_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      registerSessionFile(mediaId, file);

      const mediaRecord: MediaRecord = {
        id: mediaId,
        notebookId: notebook.id,
        type: 'video',
        mimeType: mime,
        thumbnailBlob: thumbnailBlob || undefined,
        duration,
        width,
        height,
        fileName: file.name || 'video.mp4',
        sourceUrl: file.name || 'local_video',
        fileHandle: fileHandle || undefined,
        fileSize: file.size,
        createdAt: Date.now(),
      };

      await saveMedia(mediaRecord);

      const cardWidth = Math.min(280, canvasWidth - 32);
      const cardHeight = 220;

      const { x, y, rotation } = getNextSpawnCoordinates(cardWidth, cardHeight);
      const newZ = ++maxZIndexRef.current;

      const newItem: ContentItem = {
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        notebookId: notebook.id,
        type: 'video',
        mediaId,
        fileName: file.name,
        sourceUrl: file.name,
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        rotation,
        zIndex: newZ,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveItem(newItem);
      setItems((prev) => [...prev, newItem]);
      showToast('已成功贴上视频剪辑 (轻量化存储)', 'success');

      if (y > window.scrollY + window.innerHeight - 200) {
        window.scrollTo({ top: y - 100, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('添加视频失败', err);
      showToast(err instanceof Error ? err.message : '添加视频失败', 'error');
    }
  };
  handleAddVideoRef.current = handleAddVideo;

  // 4. Add Media from URL or external address
  const handleAddUrlMedia = async (url: string, type: 'image' | 'video', customName?: string) => {
    try {
      showToast('正在链接原地址媒体...', 'info');
      const mediaId = 'media_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const fileName = customName || url.split('/').pop()?.split('?')[0] || (type === 'image' ? 'photo.jpg' : 'video.mp4');

      const mediaRecord: MediaRecord = {
        id: mediaId,
        notebookId: notebook.id,
        type,
        mimeType: type === 'image' ? 'image/jpeg' : 'video/mp4',
        fileName,
        sourceUrl: url,
        createdAt: Date.now(),
      };

      await saveMedia(mediaRecord);

      const cardWidth = Math.min(type === 'image' ? 260 : 280, canvasWidth - 32);
      const cardHeight = type === 'image' ? 220 : 220;

      const { x, y, rotation } = getNextSpawnCoordinates(cardWidth, cardHeight);
      const newZ = ++maxZIndexRef.current;

      const newItem: ContentItem = {
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        notebookId: notebook.id,
        type,
        mediaId,
        fileName,
        sourceUrl: url,
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        rotation,
        zIndex: newZ,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveItem(newItem);
      setItems((prev) => [...prev, newItem]);
      showToast(`已成功贴上${type === 'image' ? '照片' : '视频'}原链接`, 'success');

      if (y > window.scrollY + window.innerHeight - 200) {
        window.scrollTo({ top: y - 100, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('添加网络媒体失败', err);
      showToast('添加网络媒体失败', 'error');
    }
  };

  // Update text content
  const handleUpdateText = async (id: string, newText: string) => {
    try {
      const target = items.find((i) => i.id === id);
      if (!target) return;
      const updated: ContentItem = {
        ...target,
        text: newText,
        updatedAt: Date.now(),
      };
      await saveItem(updated);
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      showToast('便签内容已保存', 'success');
    } catch (err) {
      console.error(err);
      showToast('保存便签失败', 'error');
    }
  };

  // Confirm delete item
  const handleConfirmDeleteItem = async () => {
    if (!itemToDelete) return;
    const { id, mediaId } = itemToDelete;
    setItemToDelete(null);

    try {
      await deleteItem(id, mediaId);
      setItems((prev) => prev.filter((i) => i.id !== id));
      showToast('已移除该手账资料', 'success');
    } catch (err) {
      console.error(err);
      showToast('删除失败', 'error');
    }
  };

  // Bring any clicked or touched item to the front immediately
  const handleBringToFront = useCallback(
    async (itemId: string) => {
      const target = items.find((i) => i.id === itemId);
      if (!target) return;
      const newZ = ++maxZIndexRef.current;
      const updated: ContentItem = { ...target, zIndex: newZ, updatedAt: Date.now() };
      setItems((prev) => prev.map((it) => (it.id === itemId ? updated : it)));
      try {
        await saveItem(updated);
      } catch (err) {
        console.error('Failed to save zIndex', err);
      }
    },
    [items]
  );

  // ---------------- Drag, Rotate & Resize logic ----------------
  // Supports pointer events with pointer capture for reliable mobile touch + desktop mouse.
  const handleDragStart = (e: React.PointerEvent, item: ContentItem) => {
    e.stopPropagation();

    // Bring active item to top zIndex
    const newZ = ++maxZIndexRef.current;
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, zIndex: newZ } : it))
    );

    const targetElement = e.currentTarget as HTMLElement;
    targetElement.setPointerCapture(e.pointerId);

    draggingRef.current = {
      itemId: item.id,
      startX: e.clientX,
      startY: e.clientY,
      initialItemX: item.x,
      initialItemY: item.y,
      pointerId: e.pointerId,
      hasMoved: false,
    };
  };

  // Rotate interaction start
  const handleRotateStart = (e: React.PointerEvent, item: ContentItem) => {
    e.stopPropagation();

    const newZ = ++maxZIndexRef.current;
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, zIndex: newZ } : it))
    );

    const el = document.getElementById(`item-${item.id}`);
    const rect = el ? el.getBoundingClientRect() : null;
    const cx = rect ? rect.left + rect.width / 2 : item.x + (item.width || 260) / 2;
    const cy = rect ? rect.top + rect.height / 2 : item.y + (item.height || 180) / 2;

    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
    const initialRotation = item.rotation || 0;

    const targetElement = e.currentTarget as HTMLElement;
    targetElement.setPointerCapture(e.pointerId);

    // Initial subtle click feedback
    playMechanicalTick(settings.rotationSoundVolume, settings.enableRotationSound);

    rotatingRef.current = {
      itemId: item.id,
      cx,
      cy,
      startAngle,
      initialRotation,
      pointerId: e.pointerId,
      lastTickAngle: initialRotation,
      hasRotated: false,
    };
  };

  // Resize interaction start (for customizable notes)
  const handleResizeStart = (e: React.PointerEvent, item: ContentItem) => {
    e.stopPropagation();

    const newZ = ++maxZIndexRef.current;
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, zIndex: newZ } : it))
    );

    const targetElement = e.currentTarget as HTMLElement;
    targetElement.setPointerCapture(e.pointerId);

    const rotationRad = ((item.rotation || 0) * Math.PI) / 180;
    resizingRef.current = {
      itemId: item.id,
      startX: e.clientX,
      startY: e.clientY,
      initialWidth: item.width || 260,
      initialHeight: item.height || 160,
      rotationRad,
      pointerId: e.pointerId,
      hasResized: false,
    };
  };

  // Reset transformation to default
  const handleResetTransform = async (item: ContentItem) => {
    // Play mechanical sound
    playMechanicalTick(settings.rotationSoundVolume, settings.enableRotationSound);

    if (item.type === 'text') {
      const defaultWidth = 260;
      const defaultHeight = 160;
      const defaultRotation = 0;

      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, width: defaultWidth, height: defaultHeight, rotation: defaultRotation }
            : it
        )
      );

      await updateItemTransform(item.id, {
        width: defaultWidth,
        height: defaultHeight,
        rotation: defaultRotation,
      });
      showToast('便签已恢复默认大小与角度', 'info');
    } else if (item.type === 'image') {
      const defaultWidth = 240;
      const defaultHeight = 200;
      const defaultRotation = 0;

      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, width: defaultWidth, height: defaultHeight, rotation: defaultRotation }
            : it
        )
      );

      await updateItemTransform(item.id, {
        width: defaultWidth,
        height: defaultHeight,
        rotation: defaultRotation,
      });
      showToast('照片已恢复默认大小与角度', 'info');
    } else if (item.type === 'video') {
      const defaultWidth = 260;
      const defaultHeight = 210;
      const defaultRotation = 0;

      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, width: defaultWidth, height: defaultHeight, rotation: defaultRotation }
            : it
        )
      );

      await updateItemTransform(item.id, {
        width: defaultWidth,
        height: defaultHeight,
        rotation: defaultRotation,
      });
      showToast('视频已恢复默认大小与角度', 'info');
    } else {
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, rotation: 0 } : it))
      );
      await updateItemTransform(item.id, { rotation: 0 });
      showToast('已恢复默认角度 (0°)', 'info');
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // 1. Check rotating
    if (rotatingRef.current) {
      const { itemId, cx, cy, startAngle, initialRotation, lastTickAngle } = rotatingRef.current;
      const currentAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
      let angleDiff = currentAngle - startAngle;

      // Adjust wrapping around -180 to 180
      while (angleDiff > 180) angleDiff -= 360;
      while (angleDiff < -180) angleDiff += 360;

      const sensitivity = settings.rotationSensitivity || 1.0;
      let targetRotation = initialRotation + angleDiff * sensitivity;

      // Magnetic snap near 0°, 90°, -90°, 180°, -180°
      const normalizedMod = ((targetRotation % 360) + 360) % 360;
      if (normalizedMod < 3 || normalizedMod > 357) {
        targetRotation = Math.round(targetRotation / 360) * 360;
      } else if (Math.abs(normalizedMod - 90) < 3) {
        targetRotation = Math.floor(targetRotation / 360) * 360 + 90;
      } else if (Math.abs(normalizedMod - 180) < 3) {
        targetRotation = Math.floor(targetRotation / 360) * 360 + 180;
      } else if (Math.abs(normalizedMod - 270) < 3) {
        targetRotation = Math.floor(targetRotation / 360) * 360 + 270;
      }

      targetRotation = Math.round(targetRotation * 10) / 10;

      // Mechanical ratchet tick sound triggered on incremental angle advancement
      const tickStep = 6;
      if (Math.abs(targetRotation - lastTickAngle) >= tickStep) {
        playMechanicalTick(settings.rotationSoundVolume, settings.enableRotationSound);
        rotatingRef.current.lastTickAngle = targetRotation;
      }

      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, rotation: targetRotation } : it))
      );
      rotatingRef.current.hasRotated = true;
      return;
    }

    // 2. Check resizing
    if (resizingRef.current) {
      const { itemId, startX, startY, initialWidth, initialHeight, rotationRad } = resizingRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // Local coordinate projection
      const localDw = dx * Math.cos(rotationRad) + dy * Math.sin(rotationRad);
      const localDh = -dx * Math.sin(rotationRad) + dy * Math.cos(rotationRad);

      let newW = Math.max(160, Math.min(canvasWidth - 32, initialWidth + localDw));
      let newH = Math.max(90, Math.min(1200, initialHeight + localDh));

      if (settings.snapToGrid) {
        newW = Math.round(newW / 12) * 12;
        newH = Math.round(newH / 12) * 12;
      }

      setItems((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? { ...it, width: Math.round(newW), height: Math.round(newH) }
            : it
        )
      );
      resizingRef.current.hasResized = true;
      return;
    }

    // 3. Check dragging
    if (draggingRef.current) {
      const { itemId, startX, startY, initialItemX, initialItemY } = draggingRef.current;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        draggingRef.current.hasMoved = true;
      }

      const item = items.find((i) => i.id === itemId);
      const itemWidth = item ? Math.min(item.width, canvasWidth - 32) : 260;

      // Bounds clamping
      const minX = 8;
      const maxX = Math.max(minX, canvasWidth - itemWidth - 8);
      const minY = 12;

      let targetX = initialItemX + deltaX;
      let targetY = initialItemY + deltaY;

      if (settings.snapToGrid) {
        targetX = Math.round(targetX / 12) * 12;
        targetY = Math.round(targetY / 12) * 12;
      }

      const newX = Math.max(minX, Math.min(maxX, targetX));
      const newY = Math.max(minY, targetY);

      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, x: newX, y: newY } : it))
      );
    }
  };

  const handlePointerUp = async (e: React.PointerEvent) => {
    // 1. Rotation finish
    if (rotatingRef.current) {
      const { itemId, hasRotated, pointerId } = rotatingRef.current;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(pointerId);
      } catch {
        // ignore
      }
      rotatingRef.current = null;

      if (hasRotated) {
        const current = items.find((i) => i.id === itemId);
        if (current) {
          await updateItemTransform(current.id, {
            rotation: current.rotation,
            zIndex: current.zIndex,
          });
        }
      }
      return;
    }

    // 2. Resizing finish
    if (resizingRef.current) {
      const { itemId, hasResized, pointerId } = resizingRef.current;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(pointerId);
      } catch {
        // ignore
      }
      resizingRef.current = null;

      if (hasResized) {
        const current = items.find((i) => i.id === itemId);
        if (current) {
          await updateItemTransform(current.id, {
            width: current.width,
            height: current.height,
          });
        }
      }
      return;
    }

    // 3. Dragging finish
    if (draggingRef.current) {
      const { itemId, hasMoved, pointerId } = draggingRef.current;

      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(pointerId);
      } catch {
        // ignore
      }

      draggingRef.current = null;

      if (hasMoved) {
        const current = items.find((i) => i.id === itemId);
        if (current) {
          // Auto-save position to IndexedDB
          await updateItemPosition(current.id, current.x, current.y, current.zIndex);
        }
      }
    }
  };

  const currentPaperConfig = PAPER_PATTERNS.find((p) => p.id === paperPattern);
  const paperPatternClass = currentPaperConfig ? currentPaperConfig.cssClass : `paper-pattern-${paperPattern}`;

  const paperCornerClass = {
    rounded: 'paper-style-rounded',
    sharp: 'paper-style-sharp',
    stamp: 'paper-style-stamp',
  }[settings.paperCornerStyle] || 'paper-style-rounded';

  return (
    <div
      className="min-h-screen flex flex-col overflow-x-hidden"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Top Navigation Bar: Clean, warm paper journal feel */}
      <header className="sticky top-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E5DFD5] px-3 sm:px-6 py-2.5 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          {/* Left: Return & Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              id="btn-back-shelf"
              onClick={onBack}
              className="flex items-center gap-1 p-2 rounded-xl text-[#594E42] hover:bg-[#EFE7DC] transition-colors active:scale-95 shrink-0"
              title="返回手账架"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-xs sm:text-sm font-medium hidden xs:inline">手账架</span>
            </button>

            <div
              onClick={() => {
                setTitleDraft(notebook.title);
                setIsRenaming(true);
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-[#EFE7DC] transition-colors cursor-pointer group min-w-0"
              title="点击重命名手账"
            >
              <h1 className="text-base sm:text-lg font-bold text-[#2D2721] truncate tracking-tight">
                {notebook.title}
              </h1>
              <Edit2 className="w-3.5 h-3.5 text-[#9A8D80] group-hover:text-[#4A3F35] shrink-0 opacity-60 group-hover:opacity-100" />
            </div>
          </div>

          {/* Right: Paper Pattern Toggle & Settings & Quick Media Buttons & + Add Content */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Hidden file inputs for direct one-click uploading */}
            <input
              ref={directImageInputRef}
              type="file"
              multiple
              accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.heic,.bmp,.svg"
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files || []) as File[];
                for (const f of files) {
                  await handleAddImage(f);
                }
                e.target.value = '';
              }}
            />
            <input
              ref={directVideoInputRef}
              type="file"
              multiple
              accept="video/*,.mp4,.mov,.webm,.m4v,.ogv,.avi,.mkv"
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files || []) as File[];
                for (const f of files) {
                  await handleAddVideo(f);
                }
                e.target.value = '';
              }}
            />

            {/* Paper pattern selector: quick compact selector */}
            <div className="hidden sm:flex items-center bg-[#EFE9E0] p-0.5 rounded-xl border border-[#E0D7CC] text-xs">
              <select
                value={paperPattern}
                onChange={(e) => handlePatternChange(e.target.value as PaperStyle)}
                className="bg-transparent text-xs font-medium text-[#4A3F35] px-2 py-1 rounded-lg outline-none cursor-pointer"
                title="切换当前手账纸张样式"
              >
                {PAPER_PATTERNS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Cover button */}
            <button
              type="button"
              id="btn-notebook-cover"
              onClick={() => setIsCoverModalOpen(true)}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-[#F2ECE1] border border-[#DDD4C7] text-[#4A3F35] text-xs font-medium transition-all active:scale-95 shadow-2xs"
              title="定制手账本封面 (无图/文字/自选图片)"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#8C7A68]" />
              <span className="hidden sm:inline">封面</span>
            </button>

            {/* Export current notebook button */}
            <button
              type="button"
              id="btn-notebook-export"
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-[#F2ECE1] border border-[#DDD4C7] text-[#4A3F35] text-xs font-medium transition-all active:scale-95 shadow-2xs"
              title="导出这本手账 (可自选全部完整媒体或轻量缩略图/原文件链接)"
            >
              <Download className="w-3.5 h-3.5 text-[#594E42]" />
              <span className="hidden xs:inline">导出</span>
            </button>

            {/* Settings button */}
            <button
              type="button"
              id="btn-notebook-settings"
              onClick={onOpenSettings}
              className="p-2 rounded-xl bg-white/80 hover:bg-white border border-[#DDD4C7] text-[#4A3F35] transition-all active:scale-95 shadow-2xs"
              title="手账设置与视觉定制"
            >
              <Settings className="w-4 h-4 text-[#7D6F61]" />
            </button>

            {/* "+ 添加" Button: Primary action */}
            <button
              type="button"
              id="btn-add-scrap-content"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-[#4A3F35] hover:bg-[#382F26] text-[#FAF8F5] text-xs sm:text-sm font-medium transition-all active:scale-95 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>添加内容</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Journal Paper Stage */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-6 flex flex-col items-center">
        {/* Paper Sheet Container */}
        <div
          ref={canvasRef}
          id="scrapbook-paper-canvas"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingFile(true);
          }}
          onDragLeave={(e) => {
            // Only deactivate if leaving the container
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsDraggingFile(false);
            }
          }}
          onDrop={async (e) => {
            e.preventDefault();
            setIsDraggingFile(false);
            const files = Array.from(e.dataTransfer.files) as File[];
            if (files.length === 0) return;

            for (const file of files) {
              const mime = inferMimeType(file, '');
              if (mime.startsWith('image/') || file.type.startsWith('image/')) {
                await handleAddImage(file);
              } else if (mime.startsWith('video/') || file.type.startsWith('video/')) {
                await handleAddVideo(file);
              } else {
                showToast(`不支持的文件类型: ${file.name}`, 'error');
              }
            }
          }}
          style={{ minHeight: `${calculateCanvasHeight()}px`, isolation: 'isolate' }}
          className={`relative w-full border border-[#DFD8CC] shadow-[0_10px_35px_rgba(60,45,35,0.08)] overflow-hidden transition-all ${paperCornerClass} ${paperPatternClass}`}
        >
          {/* Drag file dropzone overlay */}
          {isDraggingFile && (
            <div className="absolute inset-0 z-50 bg-[#8C7A6B]/15 backdrop-blur-[2px] border-2 border-dashed border-[#8C7A6B] rounded-2xl sm:rounded-3xl flex items-center justify-center pointer-events-none transition-all animate-fade-in">
              <div className="bg-[#FAF7F2] px-6 py-4 rounded-xl shadow-lg border border-[#E6E0D6] flex items-center gap-3 text-[#4A3F35]">
                <ImageIcon className="w-6 h-6 text-[#8C7A6B]" />
                <span className="font-serif font-medium text-base">松开鼠标即可贴入照片或视频</span>
              </div>
            </div>
          )}

          {/* Subtle paper binder / margin left line on desktop */}
          <div className="hidden sm:block absolute left-8 top-0 bottom-0 w-[1px] bg-[#E8DDD0] pointer-events-none" />

          {/* Paper Header / Title Calligraphy Stamp */}
          <div className="pt-6 sm:pt-8 px-6 sm:px-12 pb-4 flex flex-col sm:flex-row items-start sm:items-end justify-between border-b border-[#EDE4D8]/60 pointer-events-none">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[#9C8F80]">
                私人事件手账
              </span>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#382F26] tracking-wide mt-0.5">
                {notebook.title}
              </h2>
            </div>

            <div className="text-[11px] text-[#A09384] pt-2 sm:pt-0">
              {items.length === 0
                ? '空白手账页 · 点击上方按钮或拖拽贴入图片/视频'
                : `共 ${items.length} 份手账剪贴 · 拖拽上方胶带自由摆放`}
            </div>
          </div>

          {/* Empty Prompt with direct clickable actions if no items yet */}
          {items.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center max-w-md mx-auto pointer-events-auto">
              <div className="w-14 h-14 rounded-2xl bg-[#F0EAE1] border border-[#E0D7CC] flex items-center justify-center text-[#827363] mb-3.5 shadow-xs">
                <Sparkles className="w-7 h-7 opacity-80" />
              </div>
              <h3 className="text-base font-semibold text-[#3D342B] mb-1">这本手账还是空白的</h3>
              <p className="text-xs text-[#807466] leading-relaxed mb-6">
                随时贴入旅途实景照片、视频剪辑或随手笔记，记录专属瞬间。
              </p>

              {/* 3 Quick action cards */}
              <div className="grid grid-cols-3 gap-2.5 w-full mb-5">
                <button
                  type="button"
                  onClick={() => directImageInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl bg-[#F7F2EA] hover:bg-[#EFE7DC] border border-[#E3DBD0] text-[#3D342B] transition-all active:scale-95 shadow-2xs group"
                >
                  <div className="w-10 h-10 rounded-xl bg-white border border-[#E0D6C8] flex items-center justify-center text-[#4B5E4B] group-hover:scale-105 transition-transform">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold">贴入照片</span>
                </button>

                <button
                  type="button"
                  onClick={() => directVideoInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl bg-[#F7F2EA] hover:bg-[#EFE7DC] border border-[#E3DBD0] text-[#3D342B] transition-all active:scale-95 shadow-2xs group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#FAF0E6] border border-[#E6D4C2] flex items-center justify-center text-[#8C4E3D] group-hover:scale-105 transition-transform">
                    <VideoIcon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold">贴入视频</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl bg-[#F7F2EA] hover:bg-[#EFE7DC] border border-[#E3DBD0] text-[#3D342B] transition-all active:scale-95 shadow-2xs group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#FFF9E6] border border-[#E5DECD] flex items-center justify-center text-[#6E5936] group-hover:scale-105 transition-transform">
                    <Type className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold">文字纸片</span>
                </button>
              </div>

              {/* Tips banner */}
              <div className="w-full rounded-xl bg-[#EFE9DF]/80 border border-[#DFD6C9] p-3 text-[11px] text-[#6E6356] leading-relaxed text-left flex flex-col gap-1">
                <span className="font-semibold text-[#4A3F35] flex items-center gap-1">
                  💡 快捷贴入技巧：
                </span>
                <p>• <b>剪贴板粘贴：</b>复制照片或截图后，直接在页面上按 <kbd className="px-1 py-0.5 rounded bg-[#FAF7F2] border border-[#DDD4C7] font-mono text-[10px]">Ctrl+V</kbd> 即可贴入。</p>
                <p>• <b>拖拽文件：</b>从桌面或文件夹将多张照片/视频直接拖进这页纸张。</p>
              </div>
            </div>
          )}

          {/* Render All Content Items Freely Placed on Paper */}
          {items.map((item) => {
            if (item.type === 'text') {
              return (
                <TextItem
                  key={item.id}
                  item={item}
                  canvasWidth={canvasWidth}
                  onDragStart={handleDragStart}
                  onRotateStart={handleRotateStart}
                  onResizeStart={handleResizeStart}
                  onResetTransform={handleResetTransform}
                  onBringToFront={handleBringToFront}
                  onUpdateText={handleUpdateText}
                  onDelete={(id) => setItemToDelete({ id })}
                />
              );
            }

            if (item.type === 'image') {
              return (
                <ImageItem
                  key={item.id}
                  item={item}
                  canvasWidth={canvasWidth}
                  onDragStart={handleDragStart}
                  onRotateStart={handleRotateStart}
                  onResizeStart={handleResizeStart}
                  onResetTransform={handleResetTransform}
                  onBringToFront={handleBringToFront}
                  onViewImage={(mediaId) => setPreviewImageId(mediaId || null)}
                  onDelete={(id, mediaId) => setItemToDelete({ id, mediaId })}
                />
              );
            }

            if (item.type === 'video') {
              return (
                <VideoItem
                  key={item.id}
                  item={item}
                  canvasWidth={canvasWidth}
                  onDragStart={handleDragStart}
                  onRotateStart={handleRotateStart}
                  onResizeStart={handleResizeStart}
                  onResetTransform={handleResetTransform}
                  onBringToFront={handleBringToFront}
                  onPlayVideo={(mediaId) => setPreviewVideoId(mediaId || null)}
                  onDelete={(id, mediaId) => setItemToDelete({ id, mediaId })}
                />
              );
            }

            return null;
          })}
        </div>
      </main>

      {/* Rename Notebook Modal */}
      {isRenaming && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsRenaming(false)}
        >
          <div
            id="rename-dialog"
            className="w-full max-w-sm bg-[#FAF8F5] rounded-2xl shadow-2xl border border-[#E3DDD4] p-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-[#2D2721] mb-3">修改手账名称</h3>
            <form onSubmit={handleSaveTitle} className="flex flex-col gap-3">
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                autoFocus
                maxLength={50}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DDD3C6] bg-white text-sm text-[#2D2721] focus:outline-hidden focus:ring-2 focus:ring-[#615143]/20 focus:border-[#615143]"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsRenaming(false)}
                  className="px-4 py-2 text-xs font-medium text-[#5E544A] bg-[#ECE5DC] hover:bg-[#E2D9CE] rounded-xl"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!titleDraft.trim()}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#4A4036] hover:bg-[#382F26] rounded-xl shadow-xs"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Content Modal */}
      <AddContentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddText={handleAddText}
        onSelectImage={handleAddImage}
        onSelectVideo={handleAddVideo}
        onAddUrlMedia={handleAddUrlMedia}
      />

      {/* Fullsize Image Viewer Modal */}
      <ImageViewerModal
        isOpen={Boolean(previewImageId)}
        mediaId={previewImageId || undefined}
        onClose={() => setPreviewImageId(null)}
      />

      {/* Video Player Modal */}
      <VideoPlayerModal
        isOpen={Boolean(previewVideoId)}
        mediaId={previewVideoId || undefined}
        onClose={() => setPreviewVideoId(null)}
      />

      {/* Item Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(itemToDelete)}
        title="移除手账资料"
        message="确定要将此项内容从手账中移除吗？相关媒体数据也将被永久删除。"
        confirmText="确认删除"
        cancelText="保留"
        isDanger={true}
        onConfirm={handleConfirmDeleteItem}
        onCancel={() => setItemToDelete(null)}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        initialNotebookId={notebook.id}
        onClose={() => setIsExportModalOpen(false)}
        showToast={showToast}
      />

      {/* Edit Cover Modal */}
      <EditCoverModal
        isOpen={isCoverModalOpen}
        notebook={notebook}
        onClose={() => setIsCoverModalOpen(false)}
        onSave={async (updated) => {
          onUpdateNotebook(updated);
          try {
            await saveNotebook(updated);
            showToast('已更新封面样式', 'success');
          } catch (e) {
            console.error('保存封面失败', e);
            showToast('保存封面失败', 'error');
          }
        }}
        showToast={showToast}
      />
    </div>
  );
};
