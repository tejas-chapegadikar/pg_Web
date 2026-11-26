import { useEffect, useState } from 'react';
import { BedDouble, Bell, Building2, CalendarDays, Compass, DoorOpen, Heart, House, LayoutGrid, MapPin, MessageSquare, Search, ShieldCheck, User, Users, Utensils, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

const BLUE = '#0046FF';
const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=700&h=560&q=70&auto=format&fit=crop`;

type Kind = 'pg' | 'flat' | 'room';
const LISTINGS: { kind: Kind; title: string; place: string; rent: string; photo: string; facts: [string, typeof Wifi][] }[] = [
  {
    kind: 'pg',
    title: 'Rose Villa PG',
    place: 'Near JEC, Jorhat',
    rent: '₹4,500',
    photo: img('1505693416388-ac5ce068fe85'),
    facts: [['Triple', BedDouble], ['Meals', Utensils], ['Wi-Fi', Wifi], ['Girls only', ShieldCheck]],
  },
  {
    kind: 'flat',
    title: 'Sunrise 2BHK',
    place: 'Gar-Ali, Jorhat',
    rent: '₹12,000',
    photo: img('1502672260266-1c1ef2d93688'),
    facts: [['2 BHK', Building2], ['Furnished', BedDouble], ['Wi-Fi', Wifi], ['Anyone', Users]],
  },
  {
    kind: 'room',
    title: 'Cozy Single Room',
    place: 'Near AAU, Jorhat',
    rent: '₹3,200',
    photo: img('1540518614846-7eded433c457'),
    facts: [['Single', DoorOpen], ['Meals', Utensils], ['Wi-Fi', Wifi], ['Boys only', ShieldCheck]],
  },
];
const CHIPS: { kind: Kind | 'all'; label: string; icon: typeof Wifi }[] = [
  { kind: 'all', label: 'All', icon: LayoutGrid },
  { kind: 'pg', label: 'PGs', icon: BedDouble },
  { kind: 'flat', label: 'Flats', icon: Building2 },
  { kind: 'room', label: 'Rooms', icon: House },
];

/**
 * A small working copy of the app's listings screen: tap the chips to switch listings,
 * tap the heart to save. It flips through the listings by itself until someone taps it.
 */
export function PhonePreview() {
  const [index, setIndex] = useState(0);
  const [chip, setChip] = useState<Kind | 'all'>('all');
  const [autoplay, setAutoplay] = useState(true);
  const [saved, setSaved] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!autoplay || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % LISTINGS.length), 3500);
    return () => clearInterval(t);
  }, [autoplay]);

  const listing = LISTINGS[index];
  const activeChip = autoplay ? 'all' : chip;
  const isSaved = saved.has(index);

  const pick = (kind: Kind | 'all') => {
    setAutoplay(false);
    setChip(kind);
    if (kind !== 'all') setIndex(LISTINGS.findIndex((l) => l.kind === kind));
  };

  return (
    <div className="w-[min(300px,82vw)] rounded-[52px] bg-ink p-[9px] shadow-[0_50px_100px_-30px_rgba(17,17,17,0.55)] ring-1 ring-black/40 md:w-[340px]">
      <div className="relative flex flex-col overflow-hidden rounded-[44px] bg-white [&>*]:shrink-0">
        {/* Status bar */}
        <div aria-hidden className="flex items-center justify-between px-7 pt-3.5 text-[12px] font-semibold">
          <span>9:41</span>
          <span className="h-6 w-20 rounded-full bg-ink" />
          <span className="flex items-end gap-[2px]">
            {[4, 6, 8, 10].map((h) => (
              <span key={h} className="w-[3px] rounded-sm bg-ink" style={{ height: h }} />
            ))}
            <span className="ml-1.5 h-[10px] w-5 rounded-[3px] bg-ink" />
          </span>
        </div>

        <div aria-hidden className="flex items-center justify-between px-5 pt-4">
          <p className="text-[22px] font-semibold tracking-tight">Discover</p>
          <div className="flex gap-3">
            <Search className="h-5 w-5" />
            <span className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </span>
          </div>
        </div>

        <div className="mt-3.5 flex gap-1.5 overflow-hidden px-4" role="group" aria-label="Preview: filter listings">
          {CHIPS.map(({ kind, label, icon: Icon }) => {
            const on = activeChip === kind;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => pick(kind)}
                aria-pressed={on}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors',
                  on ? 'text-white' : 'bg-surface hover:bg-[#e9e9ee]'
                )}
                style={on ? { backgroundColor: BLUE } : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Listing card */}
        <div className="mx-3.5 mt-3.5 rounded-[22px] bg-white shadow-[0_10px_30px_-12px_rgba(17,17,17,0.25)]">
          <div className="relative h-[clamp(150px,24vh,250px)] overflow-hidden rounded-[20px] bg-surface">
            <img key={listing.photo} src={listing.photo} alt="" className="animate-fade-in h-full w-full object-cover" />
            <button
              type="button"
              aria-label={isSaved ? 'Preview: remove from saved' : 'Preview: save'}
              aria-pressed={isSaved}
              onClick={() => {
                setAutoplay(false);
                setSaved((s) => {
                  const next = new Set(s);
                  if (next.has(index)) next.delete(index);
                  else next.add(index);
                  return next;
                });
              }}
              className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-black/15 backdrop-blur-sm transition-transform active:scale-90"
            >
              <Heart key={String(isSaved)} className={cn('h-5 w-5 text-white', isSaved && 'animate-pop fill-red-500 text-red-500')} />
            </button>
            <span aria-hidden className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1">
              {LISTINGS.map((_, i) => (
                <span key={i} className={cn('h-1.5 rounded-full bg-white transition-all', i === index ? 'w-4' : 'w-1.5 opacity-60')} />
              ))}
            </span>
          </div>
          <div aria-hidden className="px-3.5 pb-3.5 pt-2.5">
            <div key={listing.title} className="animate-fade-in">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">{listing.title}</p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] text-muted">
                    <MapPin className="h-3 w-3 shrink-0" /> {listing.place}
                  </p>
                </div>
                <p className="shrink-0 text-[16px] font-semibold" style={{ color: BLUE }}>
                  {listing.rent}
                  <span className="text-[10.5px] font-normal text-muted">/mo</span>
                </p>
              </div>
              <div className="mt-2.5 grid grid-cols-4 border-t border-black/[0.06] pt-2.5 text-center text-[10px]">
                {listing.facts.map(([label, Icon]) => (
                  <span key={label} className="flex flex-col items-center gap-1">
                    <Icon className="h-4 w-4" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <span
              className="mt-2.5 flex h-9 items-center justify-center gap-2 rounded-xl text-[12.5px] font-semibold text-white"
              style={{ backgroundColor: BLUE }}
            >
              <CalendarDays className="h-4 w-4" /> Request a visit
            </span>
          </div>
        </div>

        {/* Tab bar */}
        <div aria-hidden className="mt-3.5 grid grid-cols-5 px-3 pb-2 text-center text-[9.5px] text-muted">
          {(
            [
              ['Home', House],
              ['Discover', Compass],
              ['Saved', Heart],
              ['Requests', MessageSquare],
              ['Account', User],
            ] as const
          ).map(([label, Icon], i) => (
            <span key={label} className="flex flex-col items-center gap-1" style={i === 0 ? { color: BLUE } : undefined}>
              <Icon className="h-5 w-5" />
              {label}
            </span>
          ))}
        </div>
        <span aria-hidden className="mx-auto mb-2 h-1 w-24 rounded-full bg-ink" />
      </div>
    </div>
  );
}
