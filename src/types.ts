export type ItemType = 'text' | 'image' | 'video';

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

export type CoverType = 'none' | 'text' | 'image';

export interface AppSettings {
  backgroundSkin: BackgroundSkin;
  defaultPaperPattern: PaperStyle;
  snapToGrid: boolean;
  paperCornerStyle: 'rounded' | 'sharp' | 'stamp';
  showGridGuides: boolean;
  rotationSensitivity: number; // 0.5 to 2.0 (default 1.0)
  enableRotationSound: boolean; // default true
  rotationSoundVolume: number; // 0 to 200 (default 100)
}

export interface Notebook {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  itemCount?: number;
  coverType?: CoverType; // 'none' | 'text' | 'image'
  coverImageId?: string; // thumbnail media id if image chosen from media
  coverImageData?: string; // base64 data for custom user uploaded cover image
  coverText?: string; // custom subtitle/quote for text cover
  coverColor?: string; // custom cover tint
  paperPattern?: PaperStyle;
  backgroundSkin?: BackgroundSkin;
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
}

export interface MediaRecord {
  id: string;
  notebookId: string;
  type: 'image' | 'video';
  mimeType: string;
  blob?: Blob; // Not cached in database to keep app ultra-lightweight
  thumbnailBlob?: Blob; // Compressed lightweight thumbnail (the only cached binary)
  width?: number;
  height?: number;
  duration?: number; // in seconds for video
  fileName?: string;
  sourceUrl?: string; // Original storage address or URL
  fileHandle?: any; // FileSystemFileHandle for on-demand direct reading from disk
  fileSize?: number;
  createdAt: number;
}
