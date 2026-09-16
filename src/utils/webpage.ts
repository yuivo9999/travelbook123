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

export function normalizeWebUrl(rawUrl: string): string {
  let url = rawUrl.trim();
  if (!url) return '';
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

  // Direct video file check
  const isDirectVideoFile = /\.(mp4|webm|ogv|mov|m4v)(\?.*)?$/i.test(url);

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
  // 5. Douyin / TikTok / X / other video sites
  else if (
    hostname.includes('douyin.com') ||
    hostname.includes('tiktok.com') ||
    hostname.includes('kuaishou.com') ||
    hostname.includes('b23.tv')
  ) {
    isVideoSite = true;
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
