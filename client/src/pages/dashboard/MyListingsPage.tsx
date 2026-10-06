import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { Building2, Eye, Heart, ImagePlus, Images, Loader2, MapPin, MessageSquare, Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useDeletePG, useMyListings, useUpdatePG } from '@/hooks/usePG';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ds/Button';
import { EmptyState } from '@/components/ds/EmptyState';
import { PageHeader } from '@/components/ds/PageHeader';
import { buttonClasses } from '@/components/ds/styles';
import { ListingThumb } from '@/components/dashboard/parts';
import { PhotosDialog } from '@/components/dashboard/PhotosDialog';
import { formatRent, genderLabel, roomLabel, typeLabel, typeOf } from '@/components/listing/meta';
import type { PGListing } from '@/types';

type Filter = 'all' | 'available' | 'full';

export function MyListingsPage() {
  const { data, isLoading } = useMyListings();
  const [filter, setFilter] = useState<Filter>('all');
  const [toDelete, setToDelete] = useState<PGListing | null>(null);
  // An id, not the listing, so the window shows fresh photos after each upload
  const [photosFor, setPhotosFor] = useState<string | null>(null);

  const listings: PGListing[] = data?.data?.listings ?? [];
  const available = listings.filter((l) => l.availableRooms > 0);
  const shown = filter === 'all' ? listings : filter === 'available' ? available : listings.filter((l) => l.availableRooms <= 0);

  const tabs: { value: Filter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: listings.length },
    { value: 'available', label: 'Available', count: available.length },
    { value: 'full', label: 'Full', count: listings.length - available.length },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="My listings"
        description={listings.length ? `${listings.length} listed · ${available.length} with space right now` : undefined}
        actions={
          <Link to="/dashboard/listings/new" id="create-listing-btn" className={buttonClasses('primary', 'md', 'sm:hidden')}>
            <Plus className="h-4 w-4" />
            Add listing
          </Link>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-[24px] bg-surface" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No listings yet"
          text="Add your first PG or flat. It goes live for students straight away."
          action={
            <Link to="/dashboard/listings/new" id="first-listing-btn" className={buttonClasses('primary', 'md')}>
              <Plus className="h-4 w-4" />
              Add your first listing
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-5 flex gap-6 border-b border-black/[0.06]">
            {tabs.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setFilter(t.value)}
                className={cn(
                  'relative pb-3 text-sm font-medium transition-colors',
                  filter === t.value ? 'text-ink' : 'text-muted hover:text-ink'
                )}
              >
                {t.label} <span className="text-muted">{t.count}</span>
                {filter === t.value && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-ink" />}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="rounded-[24px] bg-surface px-6 py-10 text-center text-sm text-muted">Nothing here right now.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
              {shown.map((pg) => (
                <ListingRow key={pg._id} pg={pg} onPhotos={() => setPhotosFor(pg._id)} onDelete={() => setToDelete(pg)} />
              ))}
            </ul>
          )}
        </>
      )}

      <PhotosDialog listing={listings.find((l) => l._id === photosFor) ?? null} onClose={() => setPhotosFor(null)} />
      <DeleteDialog listing={toDelete} onClose={() => setToDelete(null)} />
    </div>
  );
}

function ListingRow({ pg, onPhotos, onDelete }: { pg: PGListing; onPhotos: () => void; onDelete: () => void }) {
  const isFull = pg.availableRooms <= 0;
  const photoCount = pg.images?.length ?? 0;
  return (
    <li className="flex flex-col gap-4 rounded-[24px] border border-black/[0.06] bg-white p-3 sm:flex-row sm:items-center">
      <Link to={`/pg/${pg._id}`} className="block sm:w-44">
        <ListingThumb pg={pg} className="aspect-[4/3] w-full rounded-[18px]" />
      </Link>

      <div className="min-w-0 flex-1 px-1 sm:px-0">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium">{typeLabel(typeOf(pg))}</span>
          {isFull && <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">Full</span>}
          {photoCount === 0 && (
            <button
              type="button"
              onClick={onPhotos}
              className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100"
            >
              <ImagePlus className="h-3 w-3" /> No photos · Add
            </button>
          )}
        </div>
        <Link to={`/pg/${pg._id}`} className="mt-2 block truncate text-[15px] font-semibold hover:underline">
          {pg.title}
        </Link>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[13px] capitalize text-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {pg.location.address}, {pg.location.city}
        </p>
        <p className="mt-2 text-[13px]">
          <span className="font-semibold text-accent">{formatRent(pg.rent)}</span>
          <span className="text-muted">/mo · {roomLabel(pg)} · {genderLabel(pg)}</span>
        </p>
        <div className="mt-2 flex items-center gap-4 text-[13px] text-muted">
          <span className="flex items-center gap-1.5" title="Views">
            <Eye className="h-3.5 w-3.5" /> {pg.analytics?.views ?? 0}
          </span>
          <span className="flex items-center gap-1.5" title="Requests">
            <MessageSquare className="h-3.5 w-3.5" /> {pg.analytics?.inquiries ?? 0}
          </span>
          <span className="flex items-center gap-1.5" title="Saved by students">
            <Heart className="h-3.5 w-3.5" /> {pg.analytics?.saves ?? 0}
          </span>
        </div>
      </div>

      {/* On phones the buttons drop below the availability control instead of running off the card */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] px-1 pt-3 sm:flex-col sm:flex-nowrap sm:items-end sm:border-0 sm:px-2 sm:pt-0">
        <AvailabilityControl pg={pg} />
        <div className="flex gap-1.5">
          <button type="button" id={`photos-${pg._id}`} onClick={onPhotos} className={buttonClasses('secondary', 'sm')}>
            <Images className="h-3.5 w-3.5" />
            Photos{photoCount > 0 && <span className="text-muted">{photoCount}</span>}
          </button>
          <Link to={`/dashboard/listings/${pg._id}/edit`} id={`edit-${pg._id}`} className={buttonClasses('secondary', 'sm')}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
          <button
            type="button"
            id={`delete-${pg._id}`}
            aria-label={`Delete ${pg.title}`}
            title="Delete"
            onClick={onDelete}
            className={buttonClasses('ghost', 'sm', 'w-10 px-0 text-muted hover:bg-red-50 hover:text-red-600')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

/** PGs: rooms-free stepper. Flats: available / rented switch. Saves straight away. */
function AvailabilityControl({ pg }: { pg: PGListing }) {
  const updatePG = useUpdatePG();
  const { addToast } = useUIStore();
  const [rooms, setRooms] = useState(pg.availableRooms);
  const isFlat = typeOf(pg) === 'flat';

  const save = async (next: number) => {
    if (next < 0 || next > pg.totalRooms || next === rooms) return;
    const previous = rooms;
    setRooms(next);
    try {
      await updatePG.mutateAsync({ id: pg._id, payload: { availableRooms: next } });
    } catch {
      setRooms(previous);
      addToast({ title: 'Couldn’t update availability', variant: 'destructive' });
    }
  };

  if (isFlat) {
    const isAvailable = rooms > 0;
    return (
      <label className="flex cursor-pointer items-center gap-2.5 text-[13px]">
        <span className="text-muted">{isAvailable ? 'Available' : 'Rented out'}</span>
        <button
          type="button"
          role="switch"
          aria-checked={isAvailable}
          id={`availability-${pg._id}`}
          onClick={() => save(isAvailable ? 0 : 1)}
          disabled={updatePG.isPending}
          className={cn('relative h-6 w-11 rounded-full transition-colors', isAvailable ? 'bg-ink' : 'bg-black/15')}
        >
          <span
            className={cn(
              'absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
              isAvailable ? 'translate-x-[22px]' : 'translate-x-0.5'
            )}
          />
        </button>
      </label>
    );
  }

  return (
    <div className="flex items-center gap-2.5 text-[13px]">
      <span className="whitespace-nowrap text-muted">Rooms free</span>
      <div className="flex items-center rounded-xl bg-surface p-1">
        <button
          type="button"
          aria-label="One less room free"
          id={`vacancy-dec-${pg._id}`}
          onClick={() => save(rooms - 1)}
          disabled={rooms <= 0 || updatePG.isPending}
          className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white disabled:opacity-30"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="flex w-14 items-center justify-center font-medium">
          {updatePG.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `${rooms} / ${pg.totalRooms}`}
        </span>
        <button
          type="button"
          aria-label="One more room free"
          id={`vacancy-inc-${pg._id}`}
          onClick={() => save(rooms + 1)}
          disabled={rooms >= pg.totalRooms || updatePG.isPending}
          className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white disabled:opacity-30"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function DeleteDialog({ listing, onClose }: { listing: PGListing | null; onClose: () => void }) {
  const deletePG = useDeletePG();
  const { addToast } = useUIStore();

  const confirm = async () => {
    if (!listing) return;
    try {
      await deletePG.mutateAsync(listing._id);
      addToast({ title: 'Listing deleted', variant: 'success' });
      onClose();
    } catch {
      addToast({ title: 'Couldn’t delete the listing', variant: 'destructive' });
    }
  };

  return (
    <Dialog.Root open={Boolean(listing)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-white p-6 font-display text-ink shadow-2xl animate-fade-in">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <Trash2 className="h-5 w-5" />
          </span>
          <Dialog.Title className="mt-4 text-xl font-semibold tracking-tight">Delete “{listing?.title}”?</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted">
            Students won’t see it any more, and its requests stay in your inbox. This can’t be undone.
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close className={buttonClasses('ghost', 'md')}>Cancel</Dialog.Close>
            <Button variant="danger" id="confirm-delete" loading={deletePG.isPending} onClick={confirm}>
              Delete listing
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
