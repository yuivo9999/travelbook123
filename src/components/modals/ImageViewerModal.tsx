import React, { useEffect, useState, useRef } from 'react';
import { X, Loader2, AlertTriangle, RefreshCw, FolderSearch, Link2 } from 'lucide-react';
import { getMedia, updateMediaSource } from '../../db/store';
import { resolveOriginalMedia, registerSessionFile, pickFilesViaPicker } from '../../utils/media';

interface ImageViewerModalProps {
  isOpen: boolean;
  mediaId?: string;
  fallbackUrl?: string;
  altText?: string;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  mediaId,
  fallbackUrl,
  altText = '手账图片',
  onClose,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [missingError, setMissingError] = useState<{ isMissing: boolean; errorText: string; fileName: string; details?: string } | null>(null);
  const [currentMedia, setCurrentMedia] = useState<any | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const relinkInputRef = useRef<HTMLInputElement>(null);

  const cleanupActiveUrl = () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
  };

  const loadOriginalImage = async () => {
    if (!isOpen) return;

    cleanupActiveUrl();
    setLoading(true);
    setMissingError(null);
    setImageUrl(null);

    try {
      if (mediaId) {
        const media = await getMedia(mediaId);
        setCurrentMedia(media);

        if (!media) {
          setMissingError({
            isMissing: true,
            errorText: `missing ${altText || 'image'}`,
            fileName: altText || 'image',
            details: '未在手账记录中找到此图片信息',
          });
          setLoading(false);
          return;
        }

        const res = await resolveOriginalMedia(media);
        if (res.success) {
          setImageUrl(res.url);
          cleanupRef.current = res.cleanup || null;
          setLoading(false);
          return;
        } else {
          const failure = res as { isMissing: boolean; error: string; fileName: string; message: string };
          setMissingError({
            isMissing: true,
            errorText: failure.error || `missing ${failure.fileName}`,
            fileName: failure.fileName,
            details: failure.message,
          });
          setLoading(false);
          return;
        }
      }

      if (fallbackUrl) {
        setImageUrl(fallbackUrl);
        setLoading(false);
        return;
      }

      setMissingError({
        isMissing: true,
        errorText: 'missing image',
        fileName: 'image',
        details: '未指定原始存储地址',
      });
      setLoading(false);
    } catch (err: any) {
      setMissingError({
        isMissing: true,
        errorText: `missing ${currentMedia?.fileName || 'image'}`,
        fileName: currentMedia?.fileName || 'image',
        details: err?.message || '访问原文件失败',
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      cleanupActiveUrl();
      setImageUrl(null);
      setMissingError(null);
      setCurrentMedia(null);
      return;
    }

    loadOriginalImage();

    return () => {
      cleanupActiveUrl();
    };
  }, [isOpen, mediaId, fallbackUrl]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Relink handler if file moved/renamed on user's disk
  const handleRelink = async () => {
    try {
      const picked = await pickFilesViaPicker('image');
      if (picked.length > 0 && mediaId) {
        const item = picked[0];
        registerSessionFile(mediaId, item.file);
        await updateMediaSource(mediaId, {
          fileHandle: item.handle,
          fileName: item.file.name,
          sourceUrl: item.file.name,
        });
        loadOriginalImage();
        return;
      }
    } catch {
      // fallback to file input
    }
    relinkInputRef.current?.click();
  };

  const handleFileInputRelink = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputFiles = e.target.files;
    if (inputFiles && inputFiles.length > 0 && mediaId) {
      const file: File = inputFiles[0];
      registerSessionFile(mediaId, file);
      await updateMediaSource(mediaId, {
        fileName: file.name,
        sourceUrl: file.name,
      });
      loadOriginalImage();
    }
    if (relinkInputRef.current) relinkInputRef.current.value = '';
  };

  if (!isOpen) return null;

  return (
    <div
      id="image-viewer-modal"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <input
        ref={relinkInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputRelink}
      />

      {/* Top right close button - Return to Scrapbook */}
      <button
        type="button"
        id="image-viewer-close-btn"
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-white/20 hover:bg-white/35 text-white backdrop-blur-sm transition-all active:scale-90 flex items-center justify-center shadow-lg"
        title="关闭浏览，返回手账本 (Esc)"
        aria-label="关闭图片浏览"
      >
        <X className="w-6 h-6 stroke-[2.5]" />
      </button>

      <div
        className="relative max-w-full max-h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()} // Prevent clicking image container from closing
      >
        {loading && (
          <div className="flex flex-col items-center gap-3 text-white/80 py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#E8DDD2]" />
            <span className="text-sm font-medium tracking-wider">正在访问原存储地址图片...</span>
          </div>
        )}

        {/* Missing File Error Display */}
        {missingError && !loading && (
          <div className="bg-[#2A231E] text-[#F3EFEA] p-6 sm:p-7 rounded-2xl border border-[#FF6B6B]/40 shadow-2xl max-w-md w-full text-center flex flex-col items-center gap-3 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-[#3D2520] border border-[#FF6B6B]/40 flex items-center justify-center text-[#FF6B6B]">
              <AlertTriangle className="w-6 h-6" />
            </div>

            {/* Exact Required "missing+文件名" display */}
            <div className="space-y-1">
              <span className="inline-block px-3 py-1 rounded-lg bg-[#FF4D4D]/20 text-[#FF7A7A] font-mono text-sm font-bold border border-[#FF4D4D]/30 tracking-wide">
                {missingError.errorText}
              </span>
              <h4 className="text-sm font-semibold text-[#EBDBC8] pt-1">原地址文件已不存在</h4>
              <p className="text-xs text-[#A89C8F] leading-relaxed">
                轻量化模式下项目不缓存原图。原文件可能已被移动、重命名或从磁盘/网络中移除。
              </p>
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-2 w-full">
              <button
                type="button"
                onClick={handleRelink}
                className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E8DDD2] hover:bg-[#FAF6F0] text-[#2D241E] text-xs font-semibold transition-all active:scale-95 shadow-sm"
              >
                <FolderSearch className="w-3.5 h-3.5" />
                <span>重新定位原文件</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#E0D8D0] text-xs font-medium transition-all"
              >
                返回手账本
              </button>
            </div>
          </div>
        )}

        {/* Fullsize Image Rendered Directly from Original Address */}
        {imageUrl && !loading && !missingError && (
          <div className="relative flex flex-col items-center gap-2">
            <img
              id="fullsize-preview-image"
              src={imageUrl}
              alt={altText}
              onError={() => {
                setMissingError({
                  isMissing: true,
                  errorText: `missing ${currentMedia?.fileName || 'image'}`,
                  fileName: currentMedia?.fileName || 'image',
                  details: '无法从原存储地址加载该图片',
                });
              }}
              className="max-w-[95vw] max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200 select-none"
            />
            {currentMedia?.fileName && (
              <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-xs text-white/70 text-[11px] font-mono flex items-center gap-1.5 max-w-[90vw] truncate">
                <Link2 className="w-3 h-3 shrink-0 opacity-70" />
                <span className="truncate">原文件: {currentMedia.fileName}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
