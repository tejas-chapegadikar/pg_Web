import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useSavedListings, useToggleSave } from '@/hooks/useInquiry';
import { EmptyState } from '@/components/ds/EmptyState';
import { PageHeader } from '@/components/ds/PageHeader';
import { buttonClasses } from '@/components/ds/styles';
import { ListingCard, ListingCardSkeleton } from '@/components/listing/ListingCard';
import type { PGListing } from '@/types';

export function SavedListingsPage() {
  const { data, isLoading } = useSavedListings();
  const toggleSave = useToggleSave();

  // A saved listing the broker has since deleted comes back without its `pg`
  const saved = ((data?.data?.saved ?? []) as { pg: PGListing | null }[])
    .map((s) => s.pg)
    .filter((pg): pg is PGListing => Boolean(pg));

  return (
    <div className="animate-fade-in">
      <PageHeader title="Saved" description={saved.length ? `${saved.length} ${saved.length === 1 ? 'place' : 'places'} you’re keeping an eye on` : undefined} />

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      ) : saved.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-6 w-6" />}
          title="Nothing saved yet"
          text="Tap the heart on any listing to keep it here for later."
          action={
            <Link to="/" className={buttonClasses('primary', 'md')}>
              Explore places
            </Link>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {saved.map((pg) => (
            <ListingCard key={pg._id} pg={pg} saved onToggleSave={() => toggleSave.mutate(pg._id)} />
          ))}
        </div>
      )}
    </div>
  );
}
