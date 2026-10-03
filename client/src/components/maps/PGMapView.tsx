/**
 * PGMapView — displays all PG listings on an interactive Google Map
 * Used in the PG List Page as an alternative to the card grid.
 */
import { useState, useCallback } from 'react';
import {
  Map,
  AdvancedMarker,
  InfoWindow,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps';
import { MapPin, BedDouble, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@/lib/utils';
import type { PGListing } from '@/types';

interface PGMapViewProps {
  listings: PGListing[];
}

interface MarkerWithInfoProps {
  pg: PGListing;
  isSelected: boolean;
  onClick: (id: string) => void;
}

function PGMarker({ pg, isSelected, onClick }: MarkerWithInfoProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const lat = pg.location.coordinates?.lat;
  const lng = pg.location.coordinates?.lng;

  if (!lat || !lng) return null;

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat, lng }}
        onClick={() => onClick(pg._id)}
        title={pg.title}
      >
        {/* Custom price bubble marker */}
        <div
          className={[
            'flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-xs font-bold shadow-lg transition-all duration-200 cursor-pointer select-none',
            isSelected
              ? 'border-ink bg-ink text-white scale-110'
              : 'border-white bg-white text-ink hover:scale-105',
          ].join(' ')}
        >
          <MapPin className="h-3 w-3" />
          {formatCurrency(pg.rent)}
          {Boolean(pg.ratingAverage) && (
            <span className="ml-1 inline-flex items-center text-[10px] text-amber-500">
              ★{pg.ratingAverage}
            </span>
          )}
        </div>
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => onClick('')} maxWidth={260}>
          <div className="p-1">
            {/* Image */}
            {pg.images?.[0] ? (
              <img
                src={pg.images[0].url}
                alt={pg.title}
                className="mb-2 h-28 w-full rounded-lg object-cover"
              />
            ) : (
              <div className="mb-2 flex h-28 items-center justify-center rounded-lg bg-slate-100">
                <BedDouble className="h-8 w-8 text-slate-300" />
              </div>
            )}
            {/* Info */}
            <div className="flex items-start justify-between gap-1">
              <p className="font-bold text-slate-800 text-sm leading-tight line-clamp-2">{pg.title}</p>
              {Boolean(pg.ratingAverage) && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 shrink-0">
                  <Star className="h-2.5 w-2.5 fill-current text-amber-400" />
                  {pg.ratingAverage}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {pg.location.address}, {pg.location.city}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-base font-semibold text-accent">
                {formatCurrency(pg.rent)}
                <span className="text-xs font-normal text-slate-400">/mo</span>
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${pg.availableRooms > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {pg.availableRooms > 0 ? `${pg.availableRooms} avail.` : 'Full'}
              </span>
            </div>
            <Link
              to={`/pg/${pg._id}`}
              className="mt-2.5 flex w-full items-center justify-center rounded-lg bg-ink py-1.5 text-xs font-medium text-white transition-colors hover:bg-black/85"
            >
              View Details →
            </Link>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export function PGMapView({ listings }: PGMapViewProps) {
  const [selectedId, setSelectedId] = useState('');

  const handleMarkerClick = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? '' : id));
  }, []);

  // Filter listings that have coordinates
  const mappable = listings.filter(
    (pg) => pg.location.coordinates?.lat && pg.location.coordinates?.lng
  );

  // Compute map center from listings
  const center =
    mappable.length > 0
      ? {
          lat:
            mappable.reduce((s, pg) => s + (pg.location.coordinates?.lat ?? 0), 0) /
            mappable.length,
          lng:
            mappable.reduce((s, pg) => s + (pg.location.coordinates?.lng ?? 0), 0) /
            mappable.length,
        }
      : { lat: 20.5937, lng: 78.9629 };

  const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
  const mapsEnabled = API_KEY && API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE';

  if (!mapsEnabled) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[28px] bg-surface px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white">
          <MapPin className="h-6 w-6" />
        </span>
        <p className="mt-4 text-lg font-semibold">Map view isn’t set up yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Add a Google Maps key as <code className="rounded bg-white px-1 text-xs">VITE_GOOGLE_MAPS_API_KEY</code> in{' '}
          <code className="rounded bg-white px-1 text-xs">client/.env</code> to see listings on a map.
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-black/[0.06] bg-white" style={{ height: 560 }}>
      <Map
        defaultCenter={center}
        defaultZoom={mappable.length > 1 ? 12 : mappable.length === 1 ? 15 : 5}
        mapId="pg-list-map"
        gestureHandling="greedy"
        style={{ width: '100%', height: '100%' }}
        onClick={() => setSelectedId('')}
      >
        {mappable.map((pg) => (
          <PGMarker
            key={pg._id}
            pg={pg}
            isSelected={selectedId === pg._id}
            onClick={handleMarkerClick}
          />
        ))}
      </Map>

      {/* No-coords warning */}
      {listings.length > 0 && mappable.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm">
          <div className="text-center">
            <MapPin className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="font-semibold text-slate-600">No listings with map coordinates</p>
            <p className="mt-1 text-sm text-slate-400">Owners need to pin their location when listing a PG</p>
          </div>
        </div>
      )}

      {/* Counter badge */}
      {mappable.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-slate-100 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-lg">
          {mappable.length} of {listings.length} place{listings.length !== 1 ? 's' : ''} on map
        </div>
      )}
    </div>
  );
}
