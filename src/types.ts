export type ItemType = 'text' | 'image' | 'video';

export type BackgroundSkin =
  | 'warm-kraft'
  | 'vintage-parchment'
  | 'cool-slate'
  | 'night-journal'
  | 'matcha-tea'
  | 'sakura-blush';

export type PaperStyle = 'dots' | 'grid' | 'lines' | 'blank' | 'craft' | 'textured';

export interface AppSettings {
  backgroundSkin: BackgroundSkin;
  defaultPaperPattern: PaperStyle;
  snapToGrid: boolean;
  paperCornerStyle: 'rounded' | 'sharp' | 'stamp';
  showGridGuides: boolean;
}

export interface Notebook {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  itemCount?: number;
  coverImageId?: string; // thumbnail media id of the first image
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
}

export interface MediaRecord {
  id: string;
  notebookId: string;
  type: 'image' | 'video';
  mimeType: string;
  blob: Blob;
  thumbnailBlob?: Blob;
  width?: number;
  height?: number;
  duration?: number; // in seconds for video
  fileName?: string;
  fileSize?: number;
  createdAt: number;
}
