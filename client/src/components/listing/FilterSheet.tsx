import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Chip } from '@/components/ds/Chip';
import { AMENITIES, BHK_OPTIONS, GENDERS, ROOM_TYPES, formatRent } from './meta';
import { EMPTY_FILTERS, PRICE_MAX, PRICE_MIN, PRICE_STEP, type ListingFilterValues } from './filters';

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: ListingFilterValues;
  onApply: (value: ListingFilterValues) => void;
}

export function FilterSheet({ open, onOpenChange, value, onApply }: FilterSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed z-50 flex flex-col bg-white font-display text-ink shadow-2xl outline-none animate-fade-in',
            'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[28px]',
            'sm:inset-x-auto sm:bottom-3 sm:right-3 sm:top-3 sm:max-h-none sm:w-[440px] sm:rounded-[28px]'
          )}
        >
          {/* Content unmounts when closed, so the draft resets to `value` on every open */}
          <FilterForm
            initial={value}
            onApply={(v) => {
              onApply(v);
              onOpenChange(false);
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FilterForm({ initial, onApply }: { initial: ListingFilterValues; onApply: (v: ListingFilterValues) => void }) {
  const [draft, setDraft] = useState(initial);
  const set = (patch: Partial<ListingFilterValues>) => setDraft((d) => ({ ...d, ...patch }));
  const toggle = <K extends 'gender' | 'room' | 'bhk'>(key: K, v: ListingFilterValues[K]) =>
    set({ [key]: draft[key] === v ? undefined : v } as Partial<ListingFilterValues>);

  return (
    <>
      <div className="flex items-center justify-between px-6 pb-4 pt-6">
        <div>
          <Dialog.Title className="text-xl font-semibold tracking-tight">Filters</Dialog.Title>
          <Dialog.Description className="mt-0.5 text-[13px] text-muted">Choose what matters to you</Dialog.Description>
        </div>
        <Dialog.Close
          aria-label="Close filters"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface transition-colors hover:bg-[#ebebee]"
        >
          <X className="h-5 w-5" />
        </Dialog.Close>
      </div>

      <div className="flex-1 space-y-7 overflow-y-auto px-6 pb-6">
        <Section title="Property type">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['all', 'All'],
                ['pg', 'PGs'],
                ['flat', 'Flats'],
              ] as const
            ).map(([v, label]) => (
              <Chip
                key={v}
                selected={draft.type === v}
                // Room sharing only describes PGs and BHK only flats — drop the one that no longer applies
                onClick={() => set({ type: v, room: v === 'flat' ? undefined : draft.room, bhk: v === 'flat' ? draft.bhk : undefined })}
              >
                {label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Monthly rent">
          <PriceRange
            min={draft.minRent ?? PRICE_MIN}
            max={draft.maxRent ?? PRICE_MAX}
            onChange={(min, max) =>
              set({ minRent: min > PRICE_MIN ? min : undefined, maxRent: max < PRICE_MAX ? max : undefined })
            }
          />
        </Section>

        <Section title="Who can stay">
          <div className="flex flex-wrap gap-2">
            {GENDERS.map((g) => (
              <Chip key={g.value} selected={draft.gender === g.value} onClick={() => toggle('gender', g.value)}>
                {g.label}
              </Chip>
            ))}
          </div>
        </Section>

        {draft.type === 'pg' && (
          <Section title="Room sharing">
            <div className="flex flex-wrap gap-2">
              {ROOM_TYPES.map((r) => (
                <Chip key={r.value} selected={draft.room === r.value} onClick={() => toggle('room', r.value)}>
                  {r.label}
                </Chip>
              ))}
            </div>
          </Section>
        )}
        {draft.type === 'flat' && (
          <Section title="Size">
            <div className="flex flex-wrap gap-2">
              {BHK_OPTIONS.map((b) => (
                <Chip key={b.value} selected={draft.bhk === b.value} onClick={() => toggle('bhk', b.value)}>
                  {b.label}
                </Chip>
              ))}
            </div>
          </Section>
        )}
        {draft.type === 'all' && (
          <p className="-mt-3 text-[13px] text-muted">Pick PGs or Flats above to filter by room sharing or BHK.</p>
        )}

        <Section title="Facilities">
          <div className="grid grid-cols-2 gap-2.5">
            {AMENITIES.map(({ value: a, label, icon: Icon }) => {
              const checked = draft.amenities.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() =>
                    set({ amenities: checked ? draft.amenities.filter((x) => x !== a) : [...draft.amenities, a] })
                  }
                  className={cn(
                    'flex items-center gap-2.5 rounded-2xl border p-2.5 text-left text-[13px] font-medium transition-colors',
                    checked ? 'border-ink' : 'border-black/[0.07] hover:border-black/20'
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 truncate">{label}</span>
                  <span
                    className={cn(
                      'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border',
                      checked ? 'border-accent bg-accent text-white' : 'border-black/15'
                    )}
                  >
                    {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-surface px-4 py-3.5">
          <span>
            <span className="block text-sm font-medium">Show full places too</span>
            <span className="block text-[13px] text-muted">Places with no rooms free right now</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={draft.includeFull}
            onClick={() => set({ includeFull: !draft.includeFull })}
            className={cn(
              'relative h-6 w-11 shrink-0 rounded-full transition-colors',
              draft.includeFull ? 'bg-ink' : 'bg-black/15'
            )}
          >
            <span
              className={cn(
                'absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                draft.includeFull ? 'translate-x-[22px]' : 'translate-x-0.5'
              )}
            />
          </button>
        </label>
      </div>

      <div className="flex gap-3 border-t border-black/[0.06] p-4">
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY_FILTERS, type: draft.type })}
          className="h-12 rounded-2xl px-5 text-sm font-medium transition-colors hover:bg-surface"
        >
          Clear all
        </button>
        <button
          type="button"
          id="apply-filters"
          onClick={() => onApply(draft)}
          className="h-12 flex-1 rounded-2xl bg-ink text-sm font-medium text-white transition-colors hover:bg-black/85"
        >
          Show results
        </button>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** Two overlaid native range inputs; only their thumbs take pointer events (see .range-dual in index.css) */
function PriceRange({ min, max, onChange }: { min: number; max: number; onChange: (min: number, max: number) => void }) {
  const pct = (v: number) => ((v - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 text-sm">
        <span className="flex-1 rounded-xl bg-surface px-3 py-2.5 font-medium">{formatRent(min)}</span>
        <span className="text-muted">to</span>
        <span className="flex-1 rounded-xl bg-surface px-3 py-2.5 text-right font-medium">
          {max >= PRICE_MAX ? `${formatRent(PRICE_MAX)}+` : formatRent(max)}
        </span>
      </div>
      <div className="relative h-6">
        {/* Inset by half a thumb so the fill lines up with the thumb centres */}
        <div className="absolute inset-x-[11px] top-1/2 h-1 -translate-y-1/2 rounded-full bg-black/10">
          <div
            className="absolute h-full rounded-full bg-ink"
            style={{ left: `${pct(min)}%`, right: `${100 - pct(max)}%` }}
          />
        </div>
        <input
          type="range"
          aria-label="Minimum rent"
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={PRICE_STEP}
          value={min}
          onChange={(e) => onChange(Math.min(Number(e.target.value), max - PRICE_STEP), max)}
          className="range-dual"
        />
        <input
          type="range"
          aria-label="Maximum rent"
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={PRICE_STEP}
          value={max}
          onChange={(e) => onChange(min, Math.max(Number(e.target.value), min + PRICE_STEP))}
          className="range-dual"
        />
      </div>
    </div>
  );
}
