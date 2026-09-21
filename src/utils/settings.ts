import { AppSettings, BackgroundSkin, PaperStyle } from '../types';

const SETTINGS_STORAGE_KEY = 'travelbook_app_settings_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  backgroundSkin: 'warm-kraft',
  defaultPaperPattern: 'dots',
  snapToGrid: false,
  paperCornerStyle: 'rounded',
  showGridGuides: false,
  rotationSensitivity: 1.0,
  enableRotationSound: true,
  rotationSoundVolume: 100,
  showActionNotifications: true,
  notificationDuration: 2000,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to parse settings from localStorage', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings to localStorage', e);
  }
}

// Storage format helpers
export async function getStorageQuotaInfo(): Promise<{
  usageText: string;
  quotaText: string;
  percentage: number;
}> {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 1;

      const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
      };

      const percent = Math.min(100, Math.round((usage / quota) * 100));
      return {
        usageText: formatBytes(usage),
        quotaText: formatBytes(quota),
        percentage: percent,
      };
    } catch {
      // ignore
    }
  }

  return {
    usageText: '本地 IndexedDB 存储',
    quotaText: '浏览器动态分配',
    percentage: 0,
  };
}

// Visual themes definition
export interface SkinConfig {
  id: BackgroundSkin;
  name: string;
  desc: string;
  bgClass: string;
  cardBgClass: string;
  textClass: string;
  accentColor: string;
  previewColor: string;
}

export const BACKGROUND_SKINS: SkinConfig[] = [
  {
    id: 'warm-kraft',
    name: '温润牛皮纸',
    desc: '温暖舒适的复古手账原色',
    bgClass: 'bg-[#F4EFEA]',
    cardBgClass: 'bg-[#FAF7F2]',
    textClass: 'text-[#2D2721]',
    accentColor: '#4A3F35',
    previewColor: '#F4EFEA',
  },
  {
    id: 'vintage-parchment',
    name: '复古羊皮纸',
    desc: '古典典雅的淡金羊皮卷感',
    bgClass: 'bg-[#EFE7D8]',
    cardBgClass: 'bg-[#FAF6EC]',
    textClass: 'text-[#362A1F]',
    accentColor: '#5C442D',
    previewColor: '#EFE7D8',
  },
  {
    id: 'cool-slate',
    name: '静谧石板灰',
    desc: '现代杂志与极简建筑质感',
    bgClass: 'bg-[#EAECEF]',
    cardBgClass: 'bg-[#F8F9FA]',
    textClass: 'text-[#1F242D]',
    accentColor: '#343A46',
    previewColor: '#EAECEF',
  },
  {
    id: 'night-journal',
    name: '深夜手账',
    desc: '护眼深色沉浸式创作体验',
    bgClass: 'bg-[#1C1C22]',
    cardBgClass: 'bg-[#25252E]',
    textClass: 'text-[#E6E4EC]',
    accentColor: '#8E85A8',
    previewColor: '#1C1C22',
  },
  {
    id: 'matcha-tea',
    name: '春日抹茶',
    desc: '恬淡自然的森林草木气息',
    bgClass: 'bg-[#E9EFE4]',
    cardBgClass: 'bg-[#F5F8F2]',
    textClass: 'text-[#273520]',
    accentColor: '#455938',
    previewColor: '#E9EFE4',
  },
  {
    id: 'sakura-blush',
    name: '落樱粉黛',
    desc: '柔和浪漫的日记甜美色调',
    bgClass: 'bg-[#F7EBEF]',
    cardBgClass: 'bg-[#FCF5F7]',
    textClass: 'text-[#422932]',
    accentColor: '#6B3E4F',
    previewColor: '#F7EBEF',
  },
];

export interface PaperPatternConfig {
  id: PaperStyle;
  name: string;
  desc: string;
  cssClass: string;
}

export const PAPER_PATTERNS: PaperPatternConfig[] = [
  {
    id: 'beige-grid',
    name: '米黄方格',
    desc: '暖调复古双线格，适合手账书写',
    cssClass: 'paper-pattern-beige-grid',
  },
  {
    id: 'blue-gray-coords',
    name: '蓝灰坐标',
    desc: '现代技术手绘与精密坐标刻度',
    cssClass: 'paper-pattern-blue-gray-coords',
  },
  {
    id: 'staff-music',
    name: '五线谱纸',
    desc: '浪漫五线乐谱手稿与旋律随笔',
    cssClass: 'paper-pattern-staff-music',
  },
  {
    id: 'sketch-paper',
    name: '素描纸纹理',
    desc: '艺术炭铅手绘颗粒粗粝冷压感',
    cssClass: 'paper-pattern-sketch-paper',
  },
  {
    id: 'map-grid',
    name: '地图网格',
    desc: '复古航海与地理经纬度网格',
    cssClass: 'paper-pattern-map-grid',
  },
  {
    id: 'dots',
    name: '点阵纸',
    desc: '5mm 经典子弹手账点阵',
    cssClass: 'paper-pattern-dots',
  },
  {
    id: 'grid',
    name: '方格纸',
    desc: '工整坐标方格纹理',
    cssClass: 'paper-pattern-grid',
  },
  {
    id: 'lines',
    name: '横线本',
    desc: '经典舒适书写信纸',
    cssClass: 'paper-pattern-lines',
  },
  {
    id: 'blank',
    name: '复古纯白',
    desc: '无拘无束自由手绘',
    cssClass: 'paper-pattern-blank',
  },
  {
    id: 'craft',
    name: '原生牛皮',
    desc: '略带粗粝纤维的暖黄原浆',
    cssClass: 'paper-pattern-craft',
  },
  {
    id: 'textured',
    name: '水彩质感',
    desc: '轻微起伏的艺术冷压纸纹',
    cssClass: 'paper-pattern-textured',
  },
];
