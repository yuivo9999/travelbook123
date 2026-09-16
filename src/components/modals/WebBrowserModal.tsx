import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ExternalLink,
  RotateCw,
  Copy,
  Check,
  Globe,
  Maximize2,
  Minimize2,
  Lock,
  Play,
  Film,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import Hls from 'hls.js';
import { parseWebUrlInfo, resolveDouyinUrl } from '../../utils/webpage';

interface WebBrowserModalProps {
  isOpen: boolean;
  url?: string;
  title?: string;
  onClose: () => void;
}

export const WebBrowserModal: React.FC<WebBrowserModalProps> = ({
  isOpen,
  url,
  title,
  onClose,
}) => {
  const [iframeKey, setIframeKey] = useState(1);
  const [isCopied, setIsCopied] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [hasIframeLoadError, setHasIframeLoadError] = useState(false);
  const [resolvedEmbedUrl, setResolvedEmbedUrl] = useState<string | null>(null);
  const [resolvedPcUrl, setResolvedPcUrl] = useState<string | null>(null);
  const [isResolvingDouyin, setIsResolvingDouyin] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const parsed = parseWebUrlInfo(url || '', title);
  const effectiveTitle = title || parsed.suggestedTitle;
  const isDirectVideo = parsed.isDirectVideoFile;
  const isDouyin = parsed.siteName.includes('抖音') || (url && url.toLowerCase().includes('douyin'));

  // Resolve Douyin short links & video IDs
  useEffect(() => {
    if (!isOpen || !url || !isDouyin) {
      setResolvedEmbedUrl(null);
      setResolvedPcUrl(null);
      setIsResolvingDouyin(false);
      return;
    }

    let isMounted = true;
    setIsResolvingDouyin(true);

    resolveDouyinUrl(url).then((res) => {
      if (!isMounted) return;
      setIsResolvingDouyin(false);
      if (res.openEmbedUrl) {
        setResolvedEmbedUrl(res.openEmbedUrl);
      }
      if (res.pcUrl) {
        setResolvedPcUrl(res.pcUrl);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, url, isDouyin]);

  useEffect(() => {
    if (!isOpen || !url || !isDirectVideo || !videoRef.current) return;

    const isM3u8 =
      url.includes('.m3u8') ||
      url.includes('m3u8') ||
      url.includes('application/x-mpegurl');

    let hls: Hls | null = null;

    if (isM3u8) {
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hls.loadSource(url);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play().catch(() => {});
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = url;
        videoRef.current.play().catch(() => {});
      }
    } else {
      videoRef.current.src = url;
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [isOpen, url, isDirectVideo, iframeKey]);

  if (!isOpen || !url) return null;

  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
    setHasIframeLoadError(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleOpenExternal = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        id="web-browser-dialog"
        className={`w-full bg-[#FAF8F5] rounded-2xl shadow-2xl border border-[#E2DAD0] flex flex-col overflow-hidden transition-all duration-300 animate-in zoom-in-95 ${
          isMaximized
            ? 'h-[96vh] max-w-[98vw]'
            : 'h-[85vh] max-w-5xl max-h-[850px]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Browser Top Navigation Bar */}
        <div className="bg-[#EFEAE2] border-b border-[#DCD3C7] px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
          {/* Left: Window decor & title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Retro window dots */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-3 h-3 rounded-full bg-[#E06C6C] hover:opacity-80 transition-opacity"
                title="关闭"
              />
              <button
                type="button"
                onClick={() => setIsMaximized(!isMaximized)}
                className="w-3 h-3 rounded-full bg-[#E5B54F] hover:opacity-80 transition-opacity"
                title={isMaximized ? '还原' : '最大化'}
              />
              <button
                type="button"
                onClick={handleRefresh}
                className="w-3 h-3 rounded-full bg-[#7BB661] hover:opacity-80 transition-opacity"
                title="刷新"
              />
            </div>

            {/* Favicon & Site Name */}
            <div className="flex items-center gap-1.5 truncate text-xs font-semibold text-[#382F26]">
              {parsed.faviconUrl ? (
                <img
                  src={parsed.faviconUrl}
                  alt=""
                  className="w-4 h-4 rounded-xs shrink-0"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <Globe className="w-3.5 h-3.5 text-[#8C7A6B] shrink-0" />
              )}
              <span className="truncate">{effectiveTitle}</span>
              {parsed.isVideoSite && (
                <span className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#4A3F35] text-white text-[10px] font-medium scale-90">
                  <Play className="w-2.5 h-2.5 fill-current" />
                  视频网页
                </span>
              )}
            </div>
          </div>

          {/* Center: URL address bar */}
          <div className="hidden md:flex flex-1 max-w-xl mx-2 items-center gap-1.5 px-3 py-1 bg-white/90 border border-[#D5CCC0] rounded-xl text-xs text-[#52463A] shadow-2xs">
            <Lock className="w-3 h-3 text-[#7B6E60] shrink-0" />
            <span className="truncate flex-1 font-mono text-[11px] select-all">
              {parsed.url}
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              className="p-1.5 rounded-lg text-[#6B5E50] hover:text-[#2A231C] hover:bg-[#E2D8CC] transition-colors"
              title="重新加载网页"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-[#6B5E50] hover:text-[#2A231C] hover:bg-[#E2D8CC] transition-colors"
              title="复制原网页网址"
            >
              {isCopied ? <Check className="w-4 h-4 text-[#2E7D32]" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 rounded-lg text-[#6B5E50] hover:text-[#2A231C] hover:bg-[#E2D8CC] transition-colors hidden sm:block"
              title={isMaximized ? '还原窗口' : '最大化窗口'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleOpenExternal}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-[#4A3F35] hover:bg-[#382F26] rounded-xl shadow-xs transition-all active:scale-95"
              title="在浏览器独立标签页打开"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">新标签页打开</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 ml-1 rounded-lg text-[#7C6F61] hover:text-[#2A231C] hover:bg-[#E2D8CC] transition-colors"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile address bar */}
        <div className="flex md:hidden items-center gap-1.5 px-3 py-1.5 bg-[#F4EFE7] border-b border-[#E0D7CB] text-xs text-[#52463A]">
          <Lock className="w-3 h-3 text-[#7B6E60] shrink-0" />
          <span className="truncate flex-1 font-mono text-[11px] select-all">
            {parsed.url}
          </span>
        </div>

        {/* Web Browser Frame Content */}
        <div className="flex-1 bg-white relative overflow-hidden flex flex-col">
          {isDouyin && (
            <div className="bg-[#FEF2F2] border-b border-[#FCA5A5] px-3.5 py-2 text-[11px] text-[#991B1B] flex items-center justify-between shrink-0 gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 font-medium">
                {isResolvingDouyin ? (
                  <Loader2 className="w-3.5 h-3.5 text-[#DC2626] animate-spin shrink-0" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0" />
                )}
                <span>
                  {isResolvingDouyin
                    ? '正在智能解析抖音视频链接...'
                    : '手机原生 PC 模式：已为您拦截去 APP 打开视频的动作与跳转，开启纯净网页播放'}
                </span>
              </div>
              <a
                href={resolvedPcUrl || parsed.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#DC2626] text-white hover:bg-[#B91C1C] flex items-center gap-1 shadow-sm transition-colors shrink-0"
              >
                🚀 在手机浏览器直达 PC 网页 <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {isDirectVideo ? (
            <div className="w-full h-full bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                key={iframeKey}
                src={parsed.url}
                controls
                autoPlay
                playsInline
                className="w-full h-full max-h-full object-contain"
              />
            </div>
          ) : (
            <iframe
              key={`${iframeKey}-${resolvedPcUrl || ''}`}
              src={isDouyin ? resolvedPcUrl || parsed.url : parsed.embedUrl || parsed.url}
              title={effectiveTitle}
              referrerPolicy="no-referrer"
              className="w-full h-full border-0 bg-white"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              sandbox={
                isDouyin
                  ? 'allow-scripts allow-same-origin allow-forms allow-presentation'
                  : 'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation allow-downloads'
              }
              onError={() => setHasIframeLoadError(true)}
            />
          )}

          {/* Fallback Tip Notification Bar for strict CSP/X-Frame-Options sites */}
          <div className="bg-[#FAF7F2] border-t border-[#EAE3D8] px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] text-[#7C6F61] shrink-0">
            <div className="flex items-center gap-1.5 truncate">
              {parsed.isVideoSite ? (
                <Film className="w-3.5 h-3.5 text-[#8C7A6B] shrink-0" />
              ) : (
                <Globe className="w-3.5 h-3.5 text-[#8C7A6B] shrink-0" />
              )}
              <span className="truncate">
                {parsed.isVideoSite
                  ? '如视频支持嵌入可直接在上方窗口播放；若网站限制内嵌，可点击右上角新标签页打开'
                  : '提示：若部分网页开启了同源限制导致白屏，点击右上角【新标签页打开】即可完整浏览'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleOpenExternal}
              className="text-[#382F26] font-semibold underline hover:text-black shrink-0"
            >
              直接前往 ↗
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
