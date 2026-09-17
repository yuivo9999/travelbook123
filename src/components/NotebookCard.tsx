import React, { useState, useEffect } from 'react';
import {
  Book,
  Calendar,
  Layers,
  Trash2,
  ArrowRight,
  Download,
  Palette,
  FileText,
} from 'lucide-react';
import { Notebook } from '../types';
import { formatDate, createSafeBlobUrl } from '../utils/media';
import { getMedia } from '../db/store';

interface NotebookCardProps {
  notebook: Notebook;
  onOpen: (id: string) => void;
  onDeleteRequest: (notebook: Notebook) => void;
  onExportRequest?: (notebook: Notebook) => void;
  onEditCoverRequest?: (notebook: Notebook) => void;
}

export const NotebookCard: React.FC<NotebookCardProps> = ({
  notebook,
  onOpen,
  onDeleteRequest,
  onExportRequest,
  onEditCoverRequest,
}) => {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    let activeUrl: string | null = null;
    let isMounted = true;

    async function loadCover() {
      // If user uploaded direct custom base64 image
      if (notebook.coverImageData && notebook.coverType !== 'none' && notebook.coverType !== 'text') {
        setCoverUrl(notebook.coverImageData);
        return;
      }

      if (notebook.coverType === 'none' || notebook.coverType === 'text') {
        setCoverUrl(null);
        return;
      }

      if (!notebook.coverImageId) {
        setCoverUrl(null);
        return;
      }

      try {
        const media = await getMedia(notebook.coverImageId);
        if (media && isMounted) {
          const blob = media.thumbnailBlob || media.blob;
          activeUrl = createSafeBlobUrl(blob, media.mimeType || 'image/jpeg');
          setCoverUrl(activeUrl);
        }
      } catch {
        // ignore cover load error
      }
    }

    loadCover();

    return () => {
      isMounted = false;
      if (activeUrl && activeUrl.startsWith('blob:')) URL.revokeObjectURL(activeUrl);
    };
  }, [notebook.coverImageId, notebook.coverImageData, notebook.coverType]);

  const showTextImage = notebook.coverType === 'text' && Boolean(notebook.coverText);
  const showCustomImage = (notebook.coverType === 'image' || !notebook.coverType) && Boolean(coverUrl);

  return (
    <div
      id={`notebook-card-${notebook.id}`}
      onClick={() => onOpen(notebook.id)}
      className="group relative bg-[#FAF7F2] rounded-2xl border border-[#E3DDD4] p-4 shadow-[var(--scrap-shadow)] hover:shadow-[var(--scrap-hover)] transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden active:scale-[0.99]"
    >
      {/* Book spine decorative accent */}
      <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-[#8C7A68]/40 border-r border-[#8C7A68]/20" />

      <div className="pl-2 flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#EFE9E0] text-[#594E42] flex items-center justify-center shrink-0 border border-[#E0D7CC]">
              <Book className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-[#2D2721] line-clamp-1 group-hover:text-[#644B32] transition-colors">
              {notebook.title}
            </h3>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {onEditCoverRequest && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditCoverRequest(notebook);
                }}
                className="p-1.5 rounded-lg text-[#998E84] hover:text-[#4A3F35] hover:bg-[#F0EAE1] transition-colors"
                title="设置封面外观 (无封面/文字/图片)"
              >
                <Palette className="w-4 h-4" />
              </button>
            )}
            {onExportRequest && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onExportRequest(notebook);
                }}
                className="p-1.5 rounded-lg text-[#998E84] hover:text-[#4A3F35] hover:bg-[#F0EAE1] transition-colors"
                title="导出这本手账"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteRequest(notebook);
              }}
              className="p-1.5 rounded-lg text-[#998E84] hover:text-[#C5221F] hover:bg-[#F0EAE1] transition-colors"
              title="删除手账"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 1. Custom Text Cover Preview */}
        {showTextImage && (
          <div className="w-full min-h-20 p-3 rounded-lg bg-[#FAF5EC] border border-[#E8DFC2] flex flex-col justify-center">
            <div className="flex items-center gap-1 text-[10px] text-[#A89480] font-serif italic mb-1">
              <FileText className="w-3 h-3" />
              <span>封面寄语</span>
            </div>
            <p className="text-xs text-[#4A3F35] leading-relaxed line-clamp-3 font-medium">
              {notebook.coverText}
            </p>
          </div>
        )}

        {/* 2. Custom or Default Image Preview */}
        {showCustomImage && (
          <div className="w-full h-24 rounded-lg overflow-hidden border border-[#E8E2D8] bg-[#EFEBE4]">
            <img
              src={coverUrl!}
              alt="封面预览"
              className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
            />
          </div>
        )}

        {/* Meta details */}
        <div className="flex items-center justify-between text-xs text-[#7A6F64] pt-1">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 opacity-70" />
            <span>{formatDate(notebook.updatedAt || notebook.createdAt)}</span>
          </div>

          <div className="flex items-center gap-1.5 font-medium">
            <Layers className="w-3.5 h-3.5 opacity-70" />
            <span>{notebook.itemCount ?? 0} 条资料</span>
          </div>
        </div>
      </div>

      <div className="pl-2 pt-3 flex items-center justify-end text-xs font-medium text-[#7C6955] group-hover:text-[#4A3D2E] gap-1 transition-colors">
        <span>翻开手账</span>
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
};
