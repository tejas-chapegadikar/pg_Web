import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BedDouble,
  Building2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LayoutGrid,
  Loader2,
  Map as MapIcon,
  Navigation,
  RotateCw,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { usePGListings } from '@/hooks/usePG';
import { useSavedListings, useToggleSave } from '@/hooks/useInquiry';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { PGMapView } from '@/components/maps/PGMapView';
import { ListingCard, ListingCardSkeleton } from '@/components/listing/ListingCard';
import { Chip, FilterSheet } from '@/components/listing/FilterSheet';
import { EMPTY_FILTERS, countActiveFilters, type ListingFilterValues } from '@/components/listing/filters';
import { AMENITIES, BHK_OPTIONS, COLLEGES, GENDERS, NEARBY_RADIUS_KM, ROOM_TYPES, formatRent } from '@/components/listing/meta';
import type { PGFilters } from '@/types';

const PAGE_SIZE = 12;

const SORTS = [
  { value: 'popular', label: 'Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'rent_asc', label: 'Lowest price' },
  { value: 'rent_desc', label: 'Highest price' },
] as const;
type Sort = (typeof SORTS)[number]['value'];

// The URL is the source of truth, so filters survive a refresh, coming back from a listing, and shared links
function readFilters(p: URLSearchParams): ListingFilterValues {
  const num = (key: string) => {
    const raw = p.get(key);
    return raw && !isNaN(Number(raw)) ? Number(raw) : undefined;
  };
  const type = p.get('type');
  const gender = p.get('gender');
  return {
    type: type === 'pg' || type === 'flat' ? type : 'all',
    gender: gender === 'male' || gender === 'female' || gender === 'any' ? gender : undefined,
    room: p.get('room') ?? undefined,
    bhk: p.get('bhk') ?? undefined,
    minRent: num('min'),
    maxRent: num('max'),
    amenities: p.get('amenities')?.split(',').filter(Boolean) ?? [],
    includeFull: p.get('full') === '1',
  };
}

function writeFilters(p: URLSearchParams, f: ListingFilterValues) {
  const set = (key: string, v: string | number | undefined) =>
    v === undefined || v === '' ? p.delete(key) : p.set(key, String(v));
  set('type', f.type === 'all' ? undefined : f.type);
  set('gender', f.gender);
  set('room', f.room);
  set('bhk', f.bhk);
  set('min', f.minRent);
  set('max', f.maxRent);
  set('amenities', f.amenities.join(','));
  set('full', f.includeFull ? '1' : undefined);
  p.delete('page');
}

export function PGListPage() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const isStudent = user?.role === 'student';

  const filters = useMemo(() => readFilters(params), [params]);
  const sortParam = params.get('sort');
  const sort: Sort = SORTS.some((s) => s.value === sortParam) ? (sortParam as Sort) : 'popular';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const view = params.get('view') === 'map' ? 'map' : 'grid';
  // `city` comes from links made by the old home page
  const q = params.get('q') ?? params.get('city') ?? '';

  const near = params.get('near');
  const college = COLLEGES.find((c) => c.id === near);
  const nearPoint =
    near === 'me' && params.get('lat') && params.get('lng')
      ? { lat: Number(params.get('lat')), lng: Number(params.get('lng')), label: 'you' }
      : college
        ? { lat: college.lat, lng: college.lng, label: college.short }
        : undefined;

  const update = (mutate: (p: URLSearchParams) => void) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        mutate(next);
        return next;
      },
      { replace: true }
    );

  // ── Search box (debounced into the URL) ──────────────────────────────────
  const [query, setQuery] = useState(q);
  const lastWritten = useRef(q);
  useEffect(() => {
    if (query.trim() === lastWritten.current) return;
    const t = setTimeout(() => {
      lastWritten.current = query.trim();
      update((p) => {
        p.delete('city');
        p.delete('page');
        if (query.trim()) p.set('q', query.trim());
        else p.delete('q');
      });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // ── Data ─────────────────────────────────────────────────────────────────
  const apiFilters: PGFilters = {
    page,
    limit: PAGE_SIZE,
    sort,
    q: q || undefined,
    propertyType: filters.type === 'all' ? undefined : filters.type,
    genderPreference: filters.gender,
    roomType: filters.room,
    bhk: filters.bhk,
    minRent: filters.minRent,
    maxRent: filters.maxRent,
    amenities: filters.amenities.length ? filters.amenities.join(',') : undefined,
    availableOnly: filters.includeFull ? undefined : true,
    lat: nearPoint?.lat,
    lng: nearPoint?.lng,
    radius: nearPoint ? NEARBY_RADIUS_KM : undefined,
  };
  const { data, isLoading, isError, refetch, isFetching } = usePGListings(apiFilters);
  const listings = data?.listings ?? [];
  const total = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.totalPages ?? 1;

  const toggleSave = useToggleSave();
  const { data: savedData } = useSavedListings({ enabled: isStudent });
  const savedIds = new Set<string>(
    (savedData?.data?.saved ?? []).map((s: { pg?: { _id: string } }) => s.pg?._id).filter(Boolean)
  );

  // ── Filters ──────────────────────────────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeCount = countActiveFilters(filters);
  const applyFilters = (f: ListingFilterValues) => update((p) => writeFilters(p, f));

  const setType = (type: ListingFilterValues['type']) =>
    applyFilters({
      ...filters,
      type,
      // Room sharing only describes PGs and BHK only flats
      room: type === 'pg' ? filters.room : undefined,
      bhk: type === 'flat' ? filters.bhk : undefined,
    });

  const activeChips: { key: string; label: string; next: ListingFilterValues }[] = [
    filters.gender && {
      key: 'gender',
      label: GENDERS.find((g) => g.value === filters.gender)?.label ?? filters.gender,
      next: { ...filters, gender: undefined },
    },
    filters.room && {
      key: 'room',
      label: `${ROOM_TYPES.find((r) => r.value === filters.room)?.label ?? filters.room} sharing`,
      next: { ...filters, room: undefined },
    },
    filters.bhk && {
      key: 'bhk',
      label: BHK_OPTIONS.find((b) => b.value === filters.bhk)?.label ?? filters.bhk,
      next: { ...filters, bhk: undefined },
    },
    (filters.minRent !== undefined || filters.maxRent !== undefined) && {
      key: 'price',
      label:
        filters.maxRent === undefined
          ? `From ${formatRent(filters.minRent!)}`
          : filters.minRent === undefined
            ? `Up to ${formatRent(filters.maxRent)}`
            : `${formatRent(filters.minRent)} – ${formatRent(filters.maxRent)}`,
      next: { ...filters, minRent: undefined, maxRent: undefined },
    },
    ...filters.amenities.map((a) => ({
      key: `amenity-${a}`,
      label: AMENITIES.find((x) => x.value === a)?.label ?? a,
      next: { ...filters, amenities: filters.amenities.filter((x) => x !== a) },
    })),
    filters.includeFull && { key: 'full', label: 'Including full', next: { ...filters, includeFull: false } },
  ].filter(Boolean) as { key: string; label: string; next: ListingFilterValues }[];

  const clearAll = () => {
    setQuery('');
    lastWritten.current = '';
    update((p) => {
      ['q', 'city', 'near', 'lat', 'lng'].forEach((k) => p.delete(k));
      writeFilters(p, { ...EMPTY_FILTERS, type: filters.type });
    });
  };

  // ── Nearby ───────────────────────────────────────────────────────────────
  const [locating, setLocating] = useState(false);
  const setNear = (id: string | null) =>
    update((p) => {
      p.delete('page');
      p.delete('lat');
      p.delete('lng');
      if (id) p.set('near', id);
      else p.delete('near');
    });

  const findNearMe = () => {
    if (near === 'me') return setNear(null);
    if (!navigator.geolocation) {
      addToast({ title: 'Location isn’t available in this browser', variant: 'destructive' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        update((p) => {
          p.delete('page');
          p.set('near', 'me');
          p.set('lat', coords.latitude.toFixed(5));
          p.set('lng', coords.longitude.toFixed(5));
        });
      },
      () => {
        setLocating(false);
        addToast({
          title: 'Couldn’t get your location',
          description: 'Allow location access in your browser to see places near you.',
          variant: 'destructive',
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const goToPage = (n: number) => {
    update((p) => (n > 1 ? p.set('page', String(n)) : p.delete('page')));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasAnyFilter = activeChips.length > 0 || Boolean(q) || Boolean(nearPoint);
  const firstName = user?.name?.split(' ')[0];

  return (
    <div>
      {/* ── Heading + search ── */}
      <div className="mb-6">
        {firstName && <p className="text-[13px] text-muted">Welcome, {firstName}</p>}
        <h1 className="mt-0.5 text-[28px] font-semibold tracking-tight">Find your next stay</h1>
      </div>

      <div className="flex gap-3">
        <label className="relative flex-1">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
          <input
            id="listing-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by area, address or city"
            className="h-12 w-full rounded-2xl border border-transparent bg-surface pl-13 pr-5 text-sm outline-none transition-all placeholder:text-muted/80 focus:border-black/10 focus:bg-white focus:ring-4 focus:ring-black/[0.04]"
          />
        </label>
        <button
          type="button"
          id="open-filters"
          onClick={() => setSheetOpen(true)}
          className="relative flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-black/85"
        >
          <SlidersHorizontal className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold ring-2 ring-white">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Type + nearby shortcuts ── */}
      <div className="scrollbar-hide -mx-4 mt-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {(
          [
            ['all', 'All', LayoutGrid],
            ['pg', 'PGs', BedDouble],
            ['flat', 'Flats', Building2],
          ] as const
        ).map(([value, label, Icon]) => (
          <Chip key={value} id={`type-${value}`} selected={filters.type === value} onClick={() => setType(value)}>
            <Icon className="h-4 w-4" />
            {label}
          </Chip>
        ))}

        <span className="mx-1.5 h-6 w-px shrink-0 bg-black/10" />

        {COLLEGES.map((c) => (
          <Chip
            key={c.id}
            selected={near === c.id}
            title={`Places within ${NEARBY_RADIUS_KM} km of ${c.name}`}
            onClick={() => setNear(near === c.id ? null : c.id)}
          >
            <GraduationCap className="h-4 w-4" />
            {c.short}
          </Chip>
        ))}
        <Chip id="near-me" selected={near === 'me'} onClick={findNearMe} disabled={locating}>
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
          Near me
        </Chip>
      </div>

      {/* ── Sort + view ── */}
      <div className="mt-6 flex items-end justify-between gap-4 border-b border-black/[0.06]">
        <div className="scrollbar-hide -mb-px flex gap-6 overflow-x-auto">
          {SORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => update((p) => (s.value === 'popular' ? p.delete('sort') : p.set('sort', s.value)))}
              className={cn(
                'relative shrink-0 whitespace-nowrap pb-3 text-sm font-medium transition-colors',
                sort === s.value ? 'text-ink' : 'text-muted hover:text-ink'
              )}
            >
              {s.label}
              {sort === s.value && <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-ink" />}
            </button>
          ))}
        </div>
        <div className="mb-2 flex shrink-0 rounded-xl bg-surface p-1">
          {(
            [
              ['grid', 'Grid', LayoutGrid],
              ['map', 'Map', MapIcon],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => update((p) => (v === 'map' ? p.set('view', 'map') : p.delete('view')))}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all',
                view === v ? 'bg-white shadow-sm' : 'text-muted hover:text-ink'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Result summary + active filters ── */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <p className="mr-2 text-sm">
          {isLoading ? (
            <span className="text-muted">Searching…</span>
          ) : (
            <>
              <span className="font-semibold">{total}</span> {total === 1 ? 'place' : 'places'}
              {nearPoint && (
                <span className="text-muted">
                  {' '}
                  within {NEARBY_RADIUS_KM} km of {nearPoint.label}
                </span>
              )}
              {q && <span className="text-muted"> for “{q}”</span>}
            </>
          )}
        </p>
        {activeChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => applyFilters(chip.next)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface pl-3 pr-2 text-[13px] font-medium transition-colors hover:bg-[#ebebee]"
          >
            {chip.label}
            <X className="h-3.5 w-3.5 text-muted" />
          </button>
        ))}
        {hasAnyFilter && (
          <button type="button" onClick={clearAll} className="text-[13px] font-medium text-muted underline-offset-4 hover:text-ink hover:underline">
            Clear all
          </button>
        )}
        {isFetching && !isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
      </div>

      {/* ── Results ── */}
      <div className="mt-5">
        {isError ? (
          <EmptyState
            icon={<RotateCw className="h-6 w-6" />}
            title="Couldn’t load listings"
            text="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => refetch() }}
          />
        ) : isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <EmptyState
            icon={<SearchX className="h-6 w-6" />}
            title="No places match"
            text={nearPoint ? `Nothing within ${NEARBY_RADIUS_KM} km yet. Try another area or fewer filters.` : 'Try a different search or fewer filters.'}
            action={hasAnyFilter ? { label: 'Clear filters', onClick: clearAll } : undefined}
          />
        ) : view === 'map' ? (
          <PGMapView listings={listings} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((pg) => (
              <ListingCard
                key={pg._id}
                pg={pg}
                saved={savedIds.has(pg._id)}
                onToggleSave={isStudent ? () => toggleSave.mutate(pg._id) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {!isLoading && !isError && totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-4">
          <PageButton label="Previous page" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
            <ChevronLeft className="h-5 w-5" />
          </PageButton>
          <span className="text-sm text-muted">
            Page <span className="font-medium text-ink">{page}</span> of {totalPages}
          </span>
          <PageButton label="Next page" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
            <ChevronRight className="h-5 w-5" />
          </PageButton>
        </div>
      )}

      <FilterSheet open={sheetOpen} onOpenChange={setSheetOpen} value={filters} onApply={applyFilters} />
    </div>
  );
}

function PageButton({ label, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-black/[0.08] transition-colors hover:bg-surface disabled:pointer-events-none disabled:opacity-40"
      {...props}
    />
  );
}

function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center rounded-[28px] bg-surface px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white">{icon}</span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 h-11 rounded-2xl bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-black/85"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
