"use client";

import { Eye, Images } from "lucide-react";

export interface PhotoAttachment {
  id?: string | number;
  url: string;
  originalName?: string;
  name?: string;
  sizeBytes?: number;
}

interface EvidencePhotosGalleryProps {
  attachments: PhotoAttachment[];
  title?: string;
  onSelectImage: (index: number) => void;
  aspectRatioClass?: string;
}

export default function EvidencePhotosGallery({
  attachments,
  title = "Evidence Photos",
  onSelectImage,
  aspectRatioClass = "aspect-square",
}: EvidencePhotosGalleryProps) {
  if (!attachments || attachments.length === 0) return null;

  // In a 3-column grid, 2 rows = 6 slots.
  // If attachments.length > 6, the photos would spill into a 3rd row.
  // In that case, we show 5 regular photos, and slot 6 becomes the blurred overflow card (+X).
  const maxSlots = 6;
  const hasOverflow = attachments.length > maxSlots;
  const visiblePhotos = hasOverflow ? attachments.slice(0, maxSlots) : attachments;
  const extraCount = attachments.length - (maxSlots - 1); // e.g. 8 - 5 = +3

  return (
    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2 w-full min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-slate-500 dark:text-slate-400 block font-bold text-xs">
          {title} ({attachments.length})
        </span>
        {hasOverflow && (
          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold cursor-pointer hover:underline" onClick={() => onSelectImage(0)}>
            View all {attachments.length} photos
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 w-full">
        {visiblePhotos.map((att, idx) => {
          const isLastSlot = hasOverflow && idx === maxSlots - 1;
          const displayName = att.originalName || att.name || `Photo ${idx + 1}`;

          if (isLastSlot) {
            return (
              <button
                key={att.id || idx}
                type="button"
                onClick={() => onSelectImage(idx)}
                className={`group relative rounded-xl overflow-hidden border-2 border-indigo-500/50 hover:border-indigo-500 ${aspectRatioClass} shadow-2xs hover:shadow-md transition-all cursor-pointer bg-slate-900`}
                title={`Click to view all ${attachments.length} photos (+${extraCount} more)`}
              >
                {/* Blurred Image underneath */}
                <img
                  src={att.url}
                  alt={displayName}
                  className="w-full h-full object-cover scale-105 filter blur-[2.5px] opacity-70 group-hover:scale-110 transition-transform"
                />

                {/* +X Overlay */}
                <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-xs flex flex-col items-center justify-center text-white p-1 text-center group-hover:bg-slate-950/75 transition-colors">
                  <div className="flex items-center gap-1 text-indigo-300 drop-shadow mb-0.5">
                    <Images className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                      More
                    </span>
                  </div>
                  <span className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-md">
                    +{extraCount}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-semibold text-slate-300 drop-shadow-xs">
                    See All
                  </span>
                </div>
              </button>
            );
          }

          return (
            <button
              key={att.id || idx}
              type="button"
              onClick={() => onSelectImage(idx)}
              className={`group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-indigo-400 ${aspectRatioClass} shadow-2xs hover:shadow-xs transition-all cursor-pointer bg-slate-900`}
              title={`${displayName} - Click to enlarge`}
            >
              <img
                src={att.url}
                alt={displayName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform opacity-95 group-hover:opacity-100"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
