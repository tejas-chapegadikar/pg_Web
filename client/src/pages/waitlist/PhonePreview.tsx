import { BedDouble, Bell, Building2, CalendarDays, Compass, Heart, House, LayoutGrid, MapPin, MessageSquare, Search, ShieldCheck, User, Utensils, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

const BLUE = '#0046FF';

/** A picture of the app's listings screen inside a phone frame (decoration only, nothing in it is clickable) */
export function PhonePreview({ photoUrl }: { photoUrl: string }) {
  return (
    <div
      aria-hidden
      className="w-[300px] rounded-[54px] bg-ink p-[9px] shadow-[0_50px_100px_-30px_rgba(17,17,17,0.55)] ring-1 ring-black/40 sm:w-[360px]"
    >
      <div className="relative flex flex-col overflow-hidden rounded-[46px] bg-white [&>*]:shrink-0">
        {/* Status bar */}
        <div className="flex items-center justify-between px-8 pt-4 text-[13px] font-semibold">
          <span>9:41</span>
          <span className="h-7 w-24 rounded-full bg-ink" />
          <span className="flex items-end gap-[2px]">
            {[4, 6, 8, 10].map((h) => (
              <span key={h} className="w-[3px] rounded-sm bg-ink" style={{ height: h }} />
            ))}
            <span className="ml-1.5 h-[10px] w-5 rounded-[3px] bg-ink" />
          </span>
        </div>

        <div className="flex items-center justify-between px-5 pt-5">
          <p className="text-[24px] font-semibold tracking-tight">Discover</p>
          <div className="flex gap-3">
            <Search className="h-5 w-5" />
            <span className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </span>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-hidden px-5">
          {[
            ['All', LayoutGrid],
            ['PGs', BedDouble],
            ['Flats', Building2],
            ['Rooms', House],
          ].map(([label, Icon], i) => {
            const I = Icon as typeof LayoutGrid;
            return (
              <span
                key={label as string}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-medium',
                  i === 0 ? 'text-white' : 'bg-surface'
                )}
                style={i === 0 ? { backgroundColor: BLUE } : undefined}
              >
                <I className="h-3.5 w-3.5" />
                {label as string}
              </span>
            );
          })}
        </div>

        {/* Listing card */}
        <div className="mx-4 mt-4 rounded-[24px] bg-white shadow-[0_10px_30px_-12px_rgba(17,17,17,0.25)]">
          <div className="relative h-[210px] overflow-hidden rounded-[22px] sm:h-[290px]">
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            <Heart className="absolute right-3 top-3 h-6 w-6 text-white drop-shadow" />
            <span className="absolute bottom-3 right-3 rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-white">1/6</span>
          </div>
          <div className="px-4 pb-4 pt-3">
            <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium">PG</span>
            <div className="mt-1.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold">Rose Villa PG</p>
                <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-muted">
                  <MapPin className="h-3 w-3 shrink-0" /> Near JEC, Jorhat
                </p>
              </div>
              <p className="shrink-0 text-[17px] font-semibold" style={{ color: BLUE }}>
                ₹4,500<span className="text-[11px] font-normal text-muted">/mo</span>
              </p>
            </div>
            <div className="mt-3 grid grid-cols-4 border-t border-black/[0.06] pt-3 text-center text-[10.5px]">
              {[
                ['Triple', BedDouble],
                ['Meals', Utensils],
                ['Wi-Fi', Wifi],
                ['Girls only', ShieldCheck],
              ].map(([label, Icon]) => {
                const I = Icon as typeof Wifi;
                return (
                  <span key={label as string} className="flex flex-col items-center gap-1">
                    <I className="h-4 w-4" />
                    {label as string}
                  </span>
                );
              })}
            </div>
            <span
              className="mt-3 flex h-10 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white"
              style={{ backgroundColor: BLUE }}
            >
              <CalendarDays className="h-4 w-4" /> Request a visit
            </span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mt-4 grid grid-cols-5 px-3 pb-2 text-center text-[10px] text-muted">
          {[
            ['Home', House],
            ['Discover', Compass],
            ['Saved', Heart],
            ['Requests', MessageSquare],
            ['Account', User],
          ].map(([label, Icon], i) => {
            const I = Icon as typeof House;
            return (
              <span key={label as string} className="flex flex-col items-center gap-1" style={i === 0 ? { color: BLUE } : undefined}>
                <I className="h-5 w-5" />
                {label as string}
              </span>
            );
          })}
        </div>
        <span className="mx-auto mb-2 h-1 w-28 rounded-full bg-ink" />
      </div>
    </div>
  );
}
