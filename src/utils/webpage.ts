/**
 * Utility functions for parsing web links, video page embeds, and bookmark information.
 */

export interface ParsedWebInfo {
  url: string;
  hostname: string;
  siteName: string;
  faviconUrl: string;
  embedUrl: string;
  isVideoSite: boolean;
  isDirectVideoFile: boolean;
  suggestedTitle: string;
}

const KNOWN_SITES: Record<string, string> = {
  'bilibili.com': '哔哩哔哩 Bilibili',
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'vimeo.com': 'Vimeo',
  'zhihu.com': '知乎 Zhihu',
  'xiaohongshu.com': '小红书 RED',
  'weibo.com': '新浪微博 Weibo',
  'douyin.com': '抖音 Douyin',
  'iesdouyin.com': '抖音 Douyin',
  'v.douyin.com': '抖音 Douyin',
  'douban.com': '豆瓣 Douban',
  'wikipedia.org': '维基百科 Wikipedia',
  'github.com': 'GitHub',
  'juejin.cn': '稀土掘金',
  'csdn.net': 'CSDN',
  'toutiao.com': '今日头条',
  'baidu.com': '百度搜索',
  'bing.com': 'Bing 搜索',
  'google.com': 'Google',
  'notion.so': 'Notion',
  'medium.com': 'Medium',
};

export function extractUrlAndTitleFromText(rawInput: string): {
  url: string;
  extractedTitle: string;
  isExtracted: boolean;
} {
  if (!rawInput) return { url: '', extractedTitle: '', isExtracted: false };

  const text = rawInput.trim();

  // Find http/https URL using regex
  const urlMatch = text.match(/(https?:\/\/[^\s\u4e00-\u9fa5,，!！;；()（）<>"']+)/i);
  if (!urlMatch) {
    return { url: text, extractedTitle: '', isExtracted: false };
  }

  const rawUrl = urlMatch[1];
  // Clean trailing punctuation
  const cleanUrl = rawUrl.replace(/[,，!！;；()（）<>"']+$|[\s]+$/g, '');

  // Check if input was purely the URL
  if (text === cleanUrl || text === rawUrl) {
    return { url: cleanUrl, extractedTitle: '', isExtracted: false };
  }

  // Remove the URL from original text to extract title/caption
  let remainingText = text.replace(rawUrl, '').replace(cleanUrl, '');

  // Clean common Douyin/Kuaishou/social sharing fluff text
  remainingText = remainingText
    .replace(/复制此链接[，,].*/gi, '')
    .replace(/打开Dou音搜索.*$/gi, '')
    .replace(/打开抖音搜索.*$/gi, '')
    .replace(/打开抖音[，,].*$/gi, '')
    .replace(/打开Dou音[，,].*$/gi, '')
    .replace(/直接观看视频[！!]?/gi, '')
    .replace(/^[0-9.]+\s+[0-9/]+\s+[a-zA-Z0-9@./:]+/gi, '') // e.g., "2.53 08/31 o@D.us JVy:/"
    .replace(/[\s\t\n]+/g, ' ')
    .trim();

  return {
    url: cleanUrl,
    extractedTitle: remainingText || '',
    isExtracted: true,
  };
}

export function normalizeWebUrl(rawUrl: string): string {
  let url = rawUrl.trim();
  if (!url) return '';

  // Extract URL if full sharing text was pasted
  const extracted = extractUrlAndTitleFromText(url);
  url = extracted.url;

  if (!/^https?:\/\//i.test(url) && !url.startsWith('//')) {
    url = 'https://' + url;
  }
  return url;
}

export function parseWebUrlInfo(rawUrl: string, customTitle?: string): ParsedWebInfo {
  const url = normalizeWebUrl(rawUrl);
  let hostname = '';
  let pathname = '';
  let searchParams: URLSearchParams | null = null;

  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    pathname = parsed.pathname;
    searchParams = parsed.searchParams;
  } catch {
    hostname = url.split('/')[0] || 'web';
  }

  // Find site name
  let siteName = '';
  for (const [domain, name] of Object.entries(KNOWN_SITES)) {
    if (hostname === domain || hostname.endsWith('.' + domain)) {
      siteName = name;
      break;
    }
  }
  if (!siteName) {
    siteName = hostname ? hostname.charAt(0).toUpperCase() + hostname.slice(1) : '网页';
  }

  // Direct video file check (including m3u8, mp4, webm, mov, m4v, ogv, ts, flv, etc.)
  const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
  const isDirectVideoFile =
    /\.(mp4|webm|ogv|mov|m4v|m3u8|ts|flv|mkv|avi)(\?.*)?$/i.test(url) ||
    cleanUrl.endsWith('.m3u8') ||
    url.includes('m3u8') ||
    url.includes('application/x-mpegurl');

  // Favicon
  const faviconUrl = hostname
    ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`
    : '';

  // Embed URL conversion for smooth video player embedding
  let embedUrl = url;
  let isVideoSite = isDirectVideoFile;

  // 1. YouTube
  if (hostname.includes('youtube.com') || hostname === 'youtu.be') {
    isVideoSite = true;
    let videoId = '';
    if (hostname === 'youtu.be') {
      videoId = pathname.slice(1).split('/')[0];
    } else if (pathname.startsWith('/shorts/')) {
      videoId = pathname.replace('/shorts/', '').split('/')[0];
    } else if (searchParams?.has('v')) {
      videoId = searchParams.get('v') || '';
    } else if (pathname.startsWith('/embed/')) {
      videoId = pathname.replace('/embed/', '').split('/')[0];
    }
    if (videoId) {
      embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`;
    }
  }
  // 2. Bilibili
  else if (hostname.includes('bilibili.com')) {
    isVideoSite = true;
    const bvMatch = pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/i) || url.match(/(BV[a-zA-Z0-9]+)/i);
    const avMatch = pathname.match(/\/video\/av([0-9]+)/i) || url.match(/av([0-9]+)/i);
    if (bvMatch && bvMatch[1]) {
      embedUrl = `https://player.bilibili.com/player.html?bvid=${bvMatch[1]}&page=1&high_quality=1&danmaku=0&autoplay=1`;
    } else if (avMatch && avMatch[1]) {
      embedUrl = `https://player.bilibili.com/player.html?aid=${avMatch[1]}&page=1&high_quality=1&danmaku=0&autoplay=1`;
    }
  }
  // 3. Vimeo
  else if (hostname.includes('vimeo.com')) {
    isVideoSite = true;
    const vimeoMatch = pathname.match(/\/(\d+)/);
    if (vimeoMatch && vimeoMatch[1]) {
      embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
    }
  }
  // 4. Youku
  else if (hostname.includes('youku.com')) {
    isVideoSite = true;
    const youkuMatch = pathname.match(/id_([a-zA-Z0-9=]+)/);
    if (youkuMatch && youkuMatch[1]) {
      embedUrl = `https://player.youku.com/embed/${youkuMatch[1]}?autoplay=1`;
    }
  }
  // 5. Douyin / TikTok / Kuaishou / Shorts
  else if (
    hostname.includes('douyin') ||
    hostname.includes('tiktok.com') ||
    hostname.includes('kuaishou.com') ||
    hostname.includes('b23.tv')
  ) {
    isVideoSite = true;
    siteName = '抖音 Douyin';
    const douyinMatch =
      pathname.match(/\/(?:share\/video|video|modal\/video)\/(\d+)/i) ||
      url.match(/video\/(\d+)/i);
    if (douyinMatch && douyinMatch[1]) {
      embedUrl = `https://m.douyin.com/share/video/${douyinMatch[1]}`;
    }
  }

  // Suggested title
  let suggestedTitle = customTitle?.trim() || '';
  if (!suggestedTitle) {
    if (isVideoSite) {
      suggestedTitle = `${siteName} 视频`;
    } else {
      suggestedTitle = `${siteName} 网页`;
    }
  }

  return {
    url,
    hostname,
    siteName,
    faviconUrl,
    embedUrl,
    isVideoSite,
    isDirectVideoFile,
    suggestedTitle,
  };
}

export async function resolveDouyinUrl(rawUrl: string): Promise<{
  videoId?: string;
  mDouyinUrl?: string;
  openEmbedUrl?: string;
  pcUrl?: string;
  finalUrl?: string;
}> {
  if (!rawUrl) return {};
  try {
    const res = await fetch(`/api/douyin-resolve?url=${encodeURIComponent(rawUrl.trim())}`);
    if (res.ok) {
      const data = await res.json();
      return {
        videoId: data.videoId,
        mDouyinUrl: data.mDouyinUrl,
        openEmbedUrl: data.openEmbedUrl,
        pcUrl: data.pcUrl,
        finalUrl: data.finalUrl,
      };
    }
  } catch (err) {
    console.warn('Douyin resolve failed:', err);
  }
  return {};
}

export function isDirectImageUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  const url = rawUrl.trim();
  if (/^data:image\//i.test(url)) return true;
  const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
  return (
    /\.(png|jpe?g|webp|avif|gif|svg|bmp|ico|tiff?|heic|heif)(\?.*)?$/i.test(url) ||
    cleanUrl.endsWith('.png') ||
    cleanUrl.endsWith('.jpg') ||
    cleanUrl.endsWith('.jpeg') ||
    cleanUrl.endsWith('.webp') ||
    cleanUrl.endsWith('.avif') ||
    cleanUrl.endsWith('.gif') ||
    cleanUrl.endsWith('.svg') ||
    cleanUrl.endsWith('.bmp') ||
    cleanUrl.endsWith('.ico') ||
    cleanUrl.endsWith('.tiff') ||
    cleanUrl.endsWith('.tif')
  );
}

export function isDirectVideoUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  const url = rawUrl.trim();
  const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
  return (
    /\.(mp4|webm|ogv|mov|m4v|m3u8|ts|flv|mkv|avi)(\?.*)?$/i.test(url) ||
    cleanUrl.endsWith('.m3u8') ||
    cleanUrl.endsWith('.mp4') ||
    cleanUrl.endsWith('.webm') ||
    url.includes('m3u8') ||
    url.includes('application/x-mpegurl')
  );
}
