import { useSavedListings, useToggleSave } from '@/hooks/useInquiry';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton, Badge } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { Link } from 'react-router-dom';
import { Heart, MapPin, Trash2, BedDouble } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { PGListing } from '@/types';

export function SavedListingsPage() {
  const { data, isLoading } = useSavedListings();
  const toggleSave = useToggleSave();

  const saved: { pg: PGListing }[] = data?.data?.saved ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Saved PGs</h1>
        <p className="text-slate-500">Your wishlist of saved PG listings</p>
      </div>

      <Card className="premium-shadow border border-slate-100 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            {saved.length} Saved {saved.length === 1 ? 'Listing' : 'Listings'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
            </div>
          ) : saved.length === 0 ? (
            <div className="py-12 text-center">
              <Heart className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="text-slate-500 font-medium">No saved listings yet</p>
              <Link to="/" className="mt-3 inline-block">
                <Button size="sm" variant="outline">Browse PGs</Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {saved.map(({ pg }) => (
                <div key={pg._id} className="group rounded-2xl border border-slate-100 bg-white overflow-hidden hover:border-blue-500/20 transition-all premium-shadow">
                  <div className="relative h-40 bg-slate-50 overflow-hidden">
                    {pg.images?.[0] ? (
                      <>
                        <img
                          src={pg.images[0].url}
                          alt={pg.title}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                        <div className="hidden absolute inset-0 flex items-center justify-center bg-slate-100">
                          <BedDouble className="h-10 w-10 text-slate-350" />
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center bg-slate-100">
                        <BedDouble className="h-10 w-10 text-slate-355" />
                      </div>
                    )}
                    <div className="absolute left-2 top-2">
                      <Badge variant={pg.availableRooms > 0 ? 'success' : 'destructive'}>
                        {pg.availableRooms > 0 ? `${pg.availableRooms} rooms` : 'Full'}
                      </Badge>
                    </div>
                    <button
                      onClick={() => toggleSave.mutate(pg._id)}
                      className="absolute right-2 top-2 rounded-full p-1.5 bg-white/95 text-red-500 hover:bg-red-50 shadow-sm transition-colors border border-red-100"
                      id={`unsave-${pg._id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="p-4">
                    <h3 className="mb-1 font-bold text-slate-800 line-clamp-1 group-hover:text-blue-600 transition-colors">{pg.title}</h3>
                    <div className="mb-2 flex items-center gap-1 text-xs text-slate-500 font-medium">
                      <MapPin className="h-3 w-3" />
                      <span>{pg.location.city}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-600">{formatCurrency(pg.rent)}<span className="text-xs font-normal text-slate-400">/mo</span></span>
                      <Link to={`/pg/${pg._id}`}>
                        <Button size="sm" variant="outline" id={`view-saved-${pg._id}`}>View</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
