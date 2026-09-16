export type ItemType = 'text' | 'image' | 'video';

export interface Notebook {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  itemCount?: number;
  coverImageId?: string; // thumbnail media id of the first image
  paperPattern?: 'dots' | 'grid' | 'lines' | 'blank';
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
