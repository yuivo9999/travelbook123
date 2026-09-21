export type ItemType = 'text' | 'image' | 'video' | 'webpage';

export type BackgroundSkin =
  | 'warm-kraft'
  | 'vintage-parchment'
  | 'cool-slate'
  | 'night-journal'
  | 'matcha-tea'
  | 'sakura-blush';

export type PaperStyle =
  | 'beige-grid'
  | 'blue-gray-coords'
  | 'staff-music'
  | 'sketch-paper'
  | 'map-grid'
  | 'dots'
  | 'grid'
  | 'lines'
  | 'blank'
  | 'craft'
  | 'textured';

export type CoverType = 'none' | 'text';

export interface AppSettings {
  backgroundSkin: BackgroundSkin;
  defaultPaperPattern: PaperStyle;
  snapToGrid: boolean;
  paperCornerStyle: 'rounded' | 'sharp' | 'stamp';
  showGridGuides: boolean;
  rotationSensitivity: number;
  enableRotationSound: boolean;
  rotationSoundVolume: number;
  /** Whether operation toasts such as save/import/export messages are shown. */
  showActionNotifications: boolean;
  /** Toast lifetime in milliseconds; 0 means stay until manually dismissed. */
  notificationDuration: number;
}

export interface TwineConnection {
  id: string;
  notebookId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  thickness: number;
}

export interface Notebook {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  itemCount?: number;
  coverType?: CoverType;
  coverImageId?: string;
  coverImageData?: string;
  coverText?: string;
  coverColor?: string;
  paperPattern?: PaperStyle;
  backgroundSkin?: BackgroundSkin;
  twines?: TwineConnection[];
}

export interface ContentItem {
  id: string;
  notebookId: string;
  type: ItemType;
  text?: string;
  mediaId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  createdAt: number;
  updatedAt: number;
  noteColor?: 'yellow' | 'white' | 'blue' | 'pink' | 'kraft';
  sourceUrl?: string;
  fileName?: string;
  pageTitle?: string;
  faviconUrl?: string;
  siteName?: string;
  isVideoSite?: boolean;
  isPinned?: boolean;
}

export interface MediaRecord {
  id: string;
  notebookId: string;
  type: 'image' | 'video';
  mimeType: string;
  blob?: Blob;
  thumbnailBlob?: Blob;
  storageKey?: string;
  width?: number;
  height?: number;
  duration?: number;
  fileName?: string;
  sourceUrl?: string;
  fileHandle?: any;
  fileSize?: number;
  createdAt: number;
}
