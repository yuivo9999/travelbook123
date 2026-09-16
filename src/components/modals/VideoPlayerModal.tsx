import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, Play, Volume2, AlertCircle } from 'lucide-react';
import { getMedia } from '../../db/indexedDB';

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
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setVideoUrl(null);
      return;
    }

    let activeUrl: string | null = null;
    let isMounted = true;

    async function loadVideo() {
      setLoading(true);
      setError(null);

      try {
        if (!mediaId) {
          throw new Error('未找到视频媒体记录');
        }

        const media = await getMedia(mediaId);
        if (!media || !media.blob) {
          throw new Error('未找到本地保存的视频数据');
        }

        if (isMounted) {
          activeUrl = URL.createObjectURL(media.blob);
          setVideoUrl(activeUrl);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : '无法播放该视频');
          setLoading(false);
        }
      }
    }

    loadVideo();

    return () => {
      isMounted = false;
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [isOpen, mediaId]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleClose = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      id="video-player-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Top right close button */}
      <button
        type="button"
        id="video-player-close-btn"
        onClick={handleClose}
        className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm transition-all active:scale-90"
        aria-label="关闭视频播放"
      >
        <X className="w-6 h-6 stroke-[2.5]" />
      </button>

      <div
        className="relative w-full max-w-2xl bg-[#1C1815] rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 text-white/80 py-24">
            <Loader2 className="w-9 h-9 animate-spin text-[#E8DDD2]" />
            <span className="text-sm font-medium tracking-wider">正在加载手账视频...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 text-center p-8 text-[#FAF6F0]">
            <AlertCircle className="w-10 h-10 text-[#FF6B6B]" />
            <p className="text-sm text-white/80">{error}</p>
            <p className="text-xs text-white/50">该视频格式可能不受当前移动浏览器直接解码</p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-3 px-5 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs text-white"
            >
              返回手账
            </button>
          </div>
        )}

        {videoUrl && !loading && !error && (
          <div className="relative w-full aspect-video bg-black flex items-center justify-center">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              playsInline
              autoPlay
              controlsList="nodownload"
              className="w-full h-full max-h-[80vh] object-contain"
            >
              您的浏览器暂不支持直接播放该格式视频
            </video>
          </div>
        )}
      </div>
    </div>
  );
};
