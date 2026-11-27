import { useState } from 'react';
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { Lock, Plus, X } from 'lucide-react';
import { adminApi, errorText, type PlatformMode, type PlatformSettings } from '@/api/admin';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { useAdmin } from './adminContext';
import { MODE_META } from './labels';
import {
  Button, Card, CardHeader, ConfirmDialog, EmptyState, Field, Input, PageHeader, Textarea, Toggle,
} from './ui';
import { fmtDateTime, titleCase } from './format';

const MODES: { value: PlatformMode; title: string; points: string[] }[] = [
  { value: 'waitlist', title: 'Waitlist', points: ['Visitors see the waitlist page only', 'Sign-in and listings stay closed'] },
  { value: 'public', title: 'Public', points: ['Everyone can browse listings', 'Sign-up, sign-in and onboarding work as normal'] },
  { value: 'maintenance', title: 'Maintenance', points: ['Visitors see a “back soon” page', 'Use while fixing something'] },
];

export function SettingsPage() {
  const { role } = useAdmin();
  const isFounder = role === 'founder';
  const qc = useQueryClient();
  const { addToast } = useUIStore();
  const { data: s, isPending, isError, refetch } = useQuery({ queryKey: ['admin-settings'], queryFn: adminApi.settings });

  const save = useMutation({
    mutationFn: (body: Partial<PlatformSettings>) => adminApi.updateSettings(body),
    onSuccess: (next) => {
      qc.setQueryData(['admin-settings'], next);
      qc.invalidateQueries({ queryKey: ['platform'] });
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
      addToast({ title: 'Settings saved', description: 'Visitors get the change within a few seconds.', variant: 'success' });
    },
    onError: (err) => addToast({ title: 'Couldn’t save', description: errorText(err), variant: 'destructive' }),
  });

  if (isError) {
    return (
      <Card>
        <EmptyState title="Couldn’t load settings" action={<Button onClick={() => refetch()}>Try again</Button>} />
      </Card>
    );
  }
  if (isPending || !s) {
    return (
      <>
        <PageHeader title="Settings" />
        <div className="space-y-4">
          <div className="skeleton h-56 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Settings" description={s.updatedBy ? `Last changed by ${s.updatedBy}, ${fmtDateTime(s.updatedAt)}` : 'How anieghar works for visitors.'} />
      <div className="space-y-4">
        <ModeCard s={s} isFounder={isFounder} save={save} />
        {/* Starts again from the saved text whenever it changes */}
        <ContentCard key={`${s.announcement}|${s.waitlistMessage}|${s.maintenanceMessage}`} s={s} save={save} />
        <div className="grid gap-4 lg:grid-cols-2">
          <CitiesCard s={s} save={save} />
          <ListingsCard s={s} isFounder={isFounder} save={save} />
        </div>
      </div>
    </>
  );
}

type Save = UseMutationResult<PlatformSettings, unknown, Partial<PlatformSettings>>;

function FounderOnly() {
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-muted">
      <Lock className="h-3.5 w-3.5" /> Founder only
    </span>
  );
}

function ModeCard({ s, isFounder, save }: { s: PlatformSettings; isFounder: boolean; save: Save }) {
  const [next, setNext] = useState<PlatformMode | null>(null);
  return (
    <Card>
      <CardHeader title="Site access" description="Takes effect right away. The admin panel keeps working in every mode." action={!isFounder && <FounderOnly />} />
      <div className="grid gap-3 p-5 md:grid-cols-3" role="radiogroup" aria-label="Site access">
        {MODES.map((m) => {
          const on = s.mode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!isFounder || save.isPending}
              onClick={() => !on && setNext(m.value)}
              className={cn(
                'rounded-xl border p-4 text-left transition-[border-color,box-shadow] disabled:cursor-not-allowed',
                on ? 'border-ink shadow-[0_0_0_1px_#111]' : 'border-black/10 enabled:hover:border-black/30',
                !isFounder && !on && 'opacity-60'
              )}
            >
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[14px] font-semibold">
                  <span className={cn('h-2 w-2 rounded-full', MODE_META[m.value].dot)} />
                  {m.title}
                </span>
                <span className={cn('flex h-4 w-4 items-center justify-center rounded-full border', on ? 'border-ink' : 'border-black/25')}>
                  {on && <span className="h-2 w-2 rounded-full bg-ink" />}
                </span>
              </span>
              <ul className="mt-2.5 space-y-1 text-[12.5px] text-muted">
                {m.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
      <ConfirmDialog
        open={Boolean(next)}
        onClose={() => setNext(null)}
        danger={next === 'maintenance'}
        loading={save.isPending}
        onConfirm={() => next && save.mutate({ mode: next }, { onSuccess: () => setNext(null) })}
        title={`Switch to ${next ? MODE_META[next].label : ''} mode?`}
        confirmLabel={`Switch to ${next ? MODE_META[next].label : ''}`}
        body={
          next === 'public'
            ? 'Anyone can open anieghar, sign up and browse listings. Check that the listings are ready.'
            : next === 'maintenance'
              ? 'Every visitor sees the “back soon” page until you switch back. You and the co-founder can still use this panel.'
              : 'Visitors only see the waitlist page. Signed-in students and brokers lose access to the app until you open it again.'
        }
      />
    </Card>
  );
}

function ContentCard({ s, save }: { s: PlatformSettings; save: Save }) {
  const [form, setForm] = useState({ announcement: s.announcement, waitlistMessage: s.waitlistMessage, maintenanceMessage: s.maintenanceMessage });
  const dirty = form.announcement !== s.announcement || form.waitlistMessage !== s.waitlistMessage || form.maintenanceMessage !== s.maintenanceMessage;
  return (
    <Card>
      <CardHeader title="Messages" description="Leave a box empty to use the built-in text." />
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(form);
        }}
      >
        <Field label="Announcement" htmlFor="set-announcement" hint={`Shown at the top of the landing page. ${form.announcement.length}/200`}>
          <Input id="set-announcement" maxLength={200} value={form.announcement} onChange={(e) => setForm({ ...form, announcement: e.target.value })} placeholder="e.g. Now live near Jorhat Engineering College" />
        </Field>
        <Field label="Waitlist message" htmlFor="set-waitlist" hint={`Under the big number. Built-in: “students are already on the waitlist”. ${form.waitlistMessage.length}/200`}>
          <Input id="set-waitlist" maxLength={200} value={form.waitlistMessage} onChange={(e) => setForm({ ...form, waitlistMessage: e.target.value })} />
        </Field>
        <Field label="Maintenance message" htmlFor="set-maintenance" hint={`${form.maintenanceMessage.length}/300`}>
          <Textarea id="set-maintenance" maxLength={300} rows={2} value={form.maintenanceMessage} onChange={(e) => setForm({ ...form, maintenanceMessage: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2">
          {dirty && (
            <Button variant="ghost" onClick={() => setForm({ announcement: s.announcement, waitlistMessage: s.waitlistMessage, maintenanceMessage: s.maintenanceMessage })}>
              Undo changes
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={!dirty} loading={save.isPending}>
            Save messages
          </Button>
        </div>
      </form>
    </Card>
  );
}

function CitiesCard({ s, save }: { s: PlatformSettings; save: Save }) {
  const [city, setCity] = useState('');
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const value = city.trim().toLowerCase();
    if (!value || s.cities.includes(value)) return;
    save.mutate({ cities: [...s.cities, value] }, { onSuccess: () => setCity('') });
  };
  return (
    <Card>
      <CardHeader title="Cities" description="Offered when adding a property." />
      <div className="space-y-4 p-5">
        <ul className="flex flex-wrap gap-2">
          {s.cities.map((c) => (
            <li key={c} className="inline-flex h-8 items-center gap-1 rounded-lg border border-black/10 pl-3 pr-1 text-[13px]">
              {titleCase(c)}
              <button
                type="button"
                aria-label={`Remove ${titleCase(c)}`}
                title="Remove"
                disabled={save.isPending || s.cities.length <= 1}
                onClick={() => save.mutate({ cities: s.cities.filter((x) => x !== c) })}
                className="flex h-6 w-6 items-center justify-center rounded-md text-ink/50 hover:bg-black/[0.05] hover:text-ink disabled:opacity-30"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={add} className="flex gap-2">
          <Input aria-label="New city" value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} placeholder="Add a city" />
          <Button type="submit" icon={<Plus className="h-4 w-4" />} disabled={!city.trim()}>
            Add
          </Button>
        </form>
        <p className="text-[12px] text-muted">Removing a city doesn’t change listings already in it.</p>
      </div>
    </Card>
  );
}

function ListingsCard({ s, isFounder, save }: { s: PlatformSettings; isFounder: boolean; save: Save }) {
  const types = s.propertyTypes ?? { pg: true, flat: true };
  return (
    <Card>
      <CardHeader title="Listings" description="What students can see in the app." />
      <div className="divide-y divide-black/[0.06] px-5">
        <SettingRow title="Show PGs" text="Turn off to hide every PG from students.">
          <Toggle label="Show PGs" checked={types.pg} disabled={save.isPending || (!types.flat && types.pg)} onChange={(v) => save.mutate({ propertyTypes: { ...types, pg: v } })} />
        </SettingRow>
        <SettingRow title="Show flats" text="Turn off to hide every flat from students.">
          <Toggle label="Show flats" checked={types.flat} disabled={save.isPending || (!types.pg && types.flat)} onChange={(v) => save.mutate({ propertyTypes: { ...types, flat: v } })} />
        </SettingRow>
        <SettingRow title="Approve new broker listings" text="New listings from brokers wait in Properties → Pending until an admin approves them." extra={!isFounder && <FounderOnly />}>
          <Toggle label="Approve new broker listings" checked={s.requireApproval} disabled={!isFounder || save.isPending} onChange={(v) => save.mutate({ requireApproval: v })} />
        </SettingRow>
      </div>
    </Card>
  );
}

function SettingRow({ title, text, extra, children }: { title: string; text: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <p className="flex items-center gap-2 text-[13.5px] font-medium">
          {title} {extra}
        </p>
        <p className="mt-0.5 text-[12.5px] text-muted">{text}</p>
      </div>
      {children}
    </div>
  );
}
