import { Link } from 'react-router-dom';
import { BedDouble, Heart, ImageOff, MapPin, Star, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PGListing } from '@/types';
import { formatRent, genderLabel, roomLabel, typeLabel, typeOf } from './meta';

interface ListingCardProps {
  pg: PGListing;
  /** Pass for students only — brokers can't save listings */
  onToggleSave?: () => void;
  saved?: boolean;
}

export function ListingCard({ pg, onToggleSave, saved = false }: ListingCardProps) {
  const cover = pg.images?.[0]?.url;
  const isFull = pg.availableRooms <= 0;

  return (
    <Link
      to={`/pg/${pg._id}`}
      id={`listing-${pg._id}`}
      className="group block rounded-[24px] border border-black/[0.06] bg-white p-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-22px_rgba(17,17,17,0.35)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-surface">
        {cover ? (
          <img
            src={cover}
            alt={pg.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            <ImageOff className="h-8 w-8" />
          </div>
        )}

        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium backdrop-blur-md">
          {typeLabel(typeOf(pg))}
        </span>

        {onToggleSave && (
          <button
            type="button"
            aria-label={saved ? 'Remove from saved' : 'Save'}
            aria-pressed={saved}
            onClick={(e) => {
              // The card is a link; saving shouldn't open the listing
              e.preventDefault();
              e.stopPropagation();
              onToggleSave();
            }}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 backdrop-blur-md transition-transform hover:scale-105"
          >
            <Heart className={cn('h-[18px] w-[18px]', saved ? 'fill-red-500 text-red-500' : 'text-ink')} />
          </button>
        )}

        {isFull && (
          <span className="absolute bottom-3 left-3 rounded-full bg-ink/80 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
            Currently full
          </span>
        )}
      </div>

      <div className="px-2 pb-1.5 pt-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="truncate text-[15px] font-semibold">{pg.title}</h3>
          <p className="shrink-0 text-[15px] font-semibold text-accent">
            {formatRent(pg.rent)}
            <span className="text-xs font-normal text-muted">/mo</span>
          </p>
        </div>
        <p className="mt-1 flex items-center gap-1 truncate text-[13px] text-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate capitalize">{pg.location.address}</span>
        </p>

        <div className="mt-3 flex items-center gap-3.5 whitespace-nowrap text-[13px]">
          <span className="flex items-center gap-1.5">
            <BedDouble className="h-4 w-4 shrink-0" />
            {roomLabel(pg, true)}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4 shrink-0" />
            {genderLabel(pg, true)}
          </span>
          {Boolean(pg.ratingAverage) && (
            <span className="ml-auto flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {pg.ratingAverage?.toFixed(1)}
              <span className="text-muted">({pg.numReviews})</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="rounded-[24px] border border-black/[0.06] bg-white p-2.5">
      <div className="aspect-[4/3] animate-pulse rounded-[18px] bg-surface" />
      <div className="space-y-2.5 px-2 pb-2 pt-3">
        <div className="h-4 w-3/4 animate-pulse rounded-full bg-surface" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-surface" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-surface" />
      </div>
    </div>
  );
}
