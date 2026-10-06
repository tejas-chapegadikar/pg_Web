import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { useDeleteImage, useUploadImages } from '@/hooks/usePG';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { buttonClasses } from '@/components/ds/styles';
import type { PGListing } from '@/types';
import { PhotoTile } from './PhotoTile';
import { MAX_NEW_PHOTOS, MAX_PHOTO_MB, PHOTO_TYPES, isAllowedPhoto } from './photoRules';

const plural = (n: number) => `${n} photo${n === 1 ? '' : 's'}`;

/**
 * Add or remove a listing's photos straight from "My listings", without going
 * through the whole edit form. Photos upload as soon as they're picked.
 */
export function PhotosDialog({ listing, onClose }: { listing: PGListing | null; onClose: () => void }) {
  const upload = useUploadImages();
  const deleteImage = useDeleteImage();
  const { addToast } = useUIStore();
  const [uploading, setUploading] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const images = listing?.images ?? [];
  const busy = uploading > 0 || deletingId !== null;

  const addPhotos = async (files: FileList | null) => {
    if (!listing || !files?.length || busy) return;
    const picked = Array.from(files);
    const allowed = picked.filter(isAllowedPhoto);
    const batch = allowed.slice(0, MAX_NEW_PHOTOS);

    if (allowed.length < picked.length) {
      const skipped = picked.length - allowed.length;
      addToast({ title: `${skipped} file${skipped > 1 ? 's' : ''} skipped`, description: `Use JPG, PNG or WEBP under ${MAX_PHOTO_MB} MB.`, variant: 'destructive' });
    } else if (allowed.length > MAX_NEW_PHOTOS) {
      addToast({ title: `Adding the first ${MAX_NEW_PHOTOS}`, description: `You can add up to ${MAX_NEW_PHOTOS} photos at a time.` });
    }
    if (!batch.length) return;

    setUploading(batch.length);
    try {
      await upload.mutateAsync({ id: listing._id, files: batch });
      addToast({ title: `${plural(batch.length)} added`, variant: 'success' });
    } catch {
      addToast({ title: 'Couldn’t upload the photos', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setUploading(0);
    }
  };

  const remove = async (publicId: string) => {
    if (!listing || busy) return;
    setDeletingId(publicId);
    try {
      await deleteImage.mutateAsync({ id: listing._id, publicId });
    } catch {
      addToast({ title: 'Couldn’t delete that photo', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog.Root open={Boolean(listing)} onOpenChange={(open) => !open && !uploading && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] animate-fade-in" />
        <Dialog.Content
          id="photos-dialog"
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(720px,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-[28px] bg-white font-display text-ink shadow-2xl animate-fade-in"
        >
          <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div className="min-w-0">
              <Dialog.Title className="text-xl font-semibold tracking-tight">Photos</Dialog.Title>
              <Dialog.Description className="mt-1 truncate text-sm text-muted">
                {listing?.title} · {images.length ? `${plural(images.length)} · the first one is the cover` : 'no photos yet'}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              disabled={uploading > 0}
              className={buttonClasses('ghost', 'sm', 'w-10 shrink-0 px-0 text-muted')}
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          <div className="space-y-4 overflow-y-auto px-6 pb-2">
            {(images.length > 0 || uploading > 0) && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {images.map((img, i) => (
                  <PhotoTile
                    key={img.publicId}
                    src={img.url}
                    cover={i === 0}
                    busy={deletingId === img.publicId}
                    label="Delete photo"
                    onRemove={() => remove(img.publicId)}
                    disabled={busy}
                  />
                ))}
                {Array.from({ length: uploading }, (_, i) => (
                  <div key={`uploading-${i}`} className="flex aspect-[4/3] items-center justify-center rounded-[18px] bg-surface">
                    <Loader2 className="h-5 w-5 animate-spin text-muted" />
                  </div>
                ))}
              </div>
            )}

            <label
              htmlFor="listing-photos-input"
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void addPhotos(e.dataTransfer.files);
              }}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[22px] border-2 border-dashed px-6 py-8 text-center transition-colors',
                dragging ? 'border-ink bg-surface' : 'border-black/10 bg-surface/60 hover:border-black/25',
                busy && 'pointer-events-none opacity-60'
              )}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              </span>
              <span className="text-sm font-semibold">
                {uploading ? `Uploading ${plural(uploading)}…` : images.length ? 'Add more photos' : 'Add photos'}
              </span>
              <span className="text-[13px] text-muted">
                Click to choose, or drop them here · JPG, PNG or WEBP up to {MAX_PHOTO_MB} MB
              </span>
              <input
                id="listing-photos-input"
                type="file"
                accept={PHOTO_TYPES.join(',')}
                multiple
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  void addPhotos(e.target.files);
                  e.target.value = ''; // allow picking the same file again
                }}
              />
            </label>

            {images.length === 0 && !uploading && (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                Real photos of the rooms, kitchen and building get far more requests from students.
              </p>
            )}
          </div>

          <div className="flex justify-end px-6 pb-6 pt-4">
            <Dialog.Close id="photos-done" disabled={uploading > 0} className={buttonClasses('primary', 'md')}>
              Done
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
