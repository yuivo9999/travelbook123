import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, AlertTriangle, FolderSearch, Link2, Film } from 'lucide-react';
import Hls from 'hls.js';
import { getMedia, updateMediaSource } from '../../db/indexedDB';
import { resolveOriginalMedia, pickFilesViaPicker } from '../../utils/media';

interface VideoPlayerModalProps {
  isOpen: boolean;
  mediaId?: string;
  onClose: () => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  isOpen,
  mediaId,
  onClose,
}) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [missingError, setMissingError] = useState<{ isMissing: boolean; errorText: string; fileName: string; details?: string } | null>(null);
  const [currentMedia, setCurrentMedia] = useState<any | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const relinkInputRef = useRef<HTMLInputElement>(null);

  const cleanupActiveUrl = () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
  };

  const loadOriginalVideo = async () => {
    if (!isOpen) return;

    cleanupActiveUrl();
    setLoading(true);
    setMissingError(null);
    setVideoUrl(null);

    try {
      if (!mediaId) {
        setMissingError({
          isMissing: true,
          errorText: 'missing video',
          fileName: 'video',
          details: '未找到视频媒体记录',
        });
        setLoading(false);
        return;
      }

      const media = await getMedia(mediaId);
      setCurrentMedia(media);

      if (!media) {
        setMissingError({
          isMissing: true,
          errorText: 'missing video',
          fileName: 'video',
          details: '未在手账数据库中找到该视频记录',
        });
        setLoading(false);
        return;
      }

      const res = await resolveOriginalMedia(media);
      if (res.success) {
        setVideoUrl(res.url);
        cleanupRef.current = res.cleanup || null;
        setLoading(false);
      } else {
        const failure = res as { isMissing: boolean; error: string; fileName: string; message: string };
        setMissingError({
          isMissing: true,
          errorText: failure.error || `missing ${failure.fileName}`,
          fileName: failure.fileName,
          details: failure.message,
        });
        setLoading(false);
      }
    } catch (err: any) {
      setMissingError({
        isMissing: true,
        errorText: `missing ${currentMedia?.fileName || 'video'}`,
        fileName: currentMedia?.fileName || 'video',
        details: err?.message || '访问原文件失败',
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
      cleanupActiveUrl();
      setVideoUrl(null);
      setMissingError(null);
      setCurrentMedia(null);
      return;
    }

    loadOriginalVideo();

    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
      }
      cleanupActiveUrl();
    };
  }, [isOpen, mediaId]);

  // Support HLS .m3u8 streaming player
  useEffect(() => {
    if (!videoUrl || !videoRef.current) return;

    const isM3u8 =
      videoUrl.includes('.m3u8') ||
      videoUrl.includes('m3u8') ||
      videoUrl.includes('application/x-mpegurl');

    let hls: Hls | null = null;

    if (isM3u8) {
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hls.loadSource(videoUrl);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal) {
            console.warn('HLS stream error:', data);
          }
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = videoUrl;
        videoRef.current.play().catch(() => {});
      }
    } else {
      videoRef.current.src = videoUrl;
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [videoUrl]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
    cleanupActiveUrl();
    onClose();
  };

  // Relink video handler if file moved/renamed on disk
  const handleRelink = async () => {
    try {
      const picked = await pickFilesViaPicker('video');
      if (picked.length > 0 && mediaId) {
        const item = picked[0];
        await updateMediaSource(mediaId, {
          file: item.file,
          fileName: item.file.name,
          sourceUrl: item.file.name,
          fileSize: item.file.size,
        });
        loadOriginalVideo();
        return;
      }
    } catch {
      // fallback
    }
    relinkInputRef.current?.click();
  };

  const handleFileInputRelink = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputFiles = e.target.files;
    if (inputFiles && inputFiles.length > 0 && mediaId) {
      const file: File = inputFiles[0];
      await updateMediaSource(mediaId, {
        file,
        fileName: file.name,
        sourceUrl: file.name,
        fileSize: file.size,
      });
      loadOriginalVideo();
    }
    if (relinkInputRef.current) relinkInputRef.current.value = '';
  };

  if (!isOpen) return null;

  return (
    <div
      id="video-player-modal"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <input
        ref={relinkInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileInputRelink}
      />

      {/* Top right close button - Return to scrapbook */}
      <button
        type="button"
        id="video-player-close-btn"
        onClick={handleClose}
        className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-white/20 hover:bg-white/35 text-white backdrop-blur-sm transition-all active:scale-90 flex items-center justify-center shadow-lg"
        title="关闭观看，返回手账本 (Esc)"
        aria-label="关闭视频播放"
      >
        <X className="w-6 h-6 stroke-[2.5]" />
      </button>

      <div
        className="relative w-full max-w-2xl bg-[#1C1815] rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 text-white/80 py-24">
            <Loader2 className="w-9 h-9 animate-spin text-[#E8DDD2]" />
            <span className="text-sm font-medium tracking-wider">正在访问原存储地址视频...</span>
          </div>
        )}

        {/* Missing Video Error Display */}
        {missingError && !loading && (
          <div className="flex flex-col items-center gap-3 text-center p-8 text-[#FAF6F0] bg-[#221C18]">
            <div className="w-12 h-12 rounded-full bg-[#3D2520] border border-[#FF6B6B]/40 flex items-center justify-center text-[#FF6B6B]">
              <AlertTriangle className="w-6 h-6" />
            </div>

            {/* Exact Required "missing+文件名" display */}
            <div className="space-y-1">
              <span className="inline-block px-3 py-1 rounded-lg bg-[#FF4D4D]/20 text-[#FF7A7A] font-mono text-sm font-bold border border-[#FF4D4D]/30 tracking-wide">
                {missingError.errorText}
              </span>
              <h4 className="text-sm font-semibold text-[#EBDBC8] pt-1">原地址视频已不存在</h4>
              <p className="text-xs text-[#A89C8F] max-w-md leading-relaxed">
                视频文件可能已被移动、删除或原存储路径失效。
              </p>
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-3 w-full max-w-xs">
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
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#E0D8D0] text-xs font-medium transition-all"
              >
                返回手账本
              </button>
            </div>
          </div>
        )}

        {/* Video Player Playing Directly from Original Address */}
        {videoUrl && !loading && !missingError && (
          <div className="relative w-full aspect-video bg-black flex flex-col items-center justify-center">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              playsInline
              autoPlay
              controlsList="nodownload"
              onError={() => {
                setMissingError({
                  isMissing: true,
                  errorText: `missing ${currentMedia?.fileName || 'video'}`,
                  fileName: currentMedia?.fileName || 'video',
                  details: '无法从原存储地址加载或解码该视频',
                });
              }}
              className="w-full h-full max-h-[80vh] object-contain"
            >
              您的浏览器暂不支持直接播放该格式视频
            </video>
            {currentMedia?.fileName && (
              <div className="absolute bottom-2 left-3 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-xs text-white/70 text-[10px] font-mono flex items-center gap-1 max-w-[80vw] truncate pointer-events-none">
                <Link2 className="w-2.5 h-2.5 shrink-0 opacity-70" />
                <span className="truncate">原文件: {currentMedia.fileName}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
