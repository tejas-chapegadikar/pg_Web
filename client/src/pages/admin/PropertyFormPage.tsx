import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BadgeCheck, Check, ExternalLink, ImagePlus, Star, Trash2, X } from 'lucide-react';
import { adminApi, errorText, type AdminListing } from '@/api/admin';
import { AMENITIES, GENDERS, ROOM_TYPES } from '@/components/listing/meta';
import { compressImage } from '@/lib/compressImage';
import { isAllowedPhoto, MAX_PHOTO_MB } from '@/components/dashboard/photoRules';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { usePropertyActions } from './propertyActions';
import { listingState } from './labels';
import {
  Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, Field, IconButton, Input, Select, Textarea, Toggle,
} from './ui';
import { fmtDateTime, titleCase } from './format';
import { ADMIN } from './adminPath';

type Form = {
  propertyType: 'pg' | 'flat';
  title: string;
  description: string;
  city: string;
  locality: string;
  address: string;
  state: string;
  pincode: string;
  lat: string;
  lng: string;
  rent: string;
  deposit: string;
  additionalCharges: string;
  rentIncludes: string;
  roomType: string;
  bhk: string;
  genderPreference: string;
  furnishing: string;
  totalRooms: string;
  availableRooms: string;
  isAvailable: boolean;
  amenities: string[];
  contactName: string;
  contactPhone: string;
  ownerEmail: string;
  rules: string;
};

const EMPTY: Form = {
  propertyType: 'pg', title: '', description: '', city: '', locality: '', address: '', state: 'Assam', pincode: '', lat: '', lng: '',
  rent: '', deposit: '', additionalCharges: '', rentIncludes: '', roomType: '', bhk: '', genderPreference: '', furnishing: '',
  totalRooms: '', availableRooms: '', isAvailable: true, amenities: [], contactName: '', contactPhone: '', ownerEmail: '', rules: '',
};

const fromListing = (pg: AdminListing): Form => ({
  propertyType: pg.propertyType === 'flat' ? 'flat' : 'pg',
  title: pg.title ?? '',
  description: pg.description ?? '',
  city: pg.location?.city ?? '',
  locality: pg.location?.locality ?? '',
  address: pg.location?.address ?? '',
  state: pg.location?.state ?? '',
  pincode: pg.location?.pincode ?? '',
  lat: pg.location?.coordinates?.lat?.toString() ?? '',
  lng: pg.location?.coordinates?.lng?.toString() ?? '',
  rent: pg.rent?.toString() ?? '',
  deposit: pg.deposit?.toString() ?? '',
  additionalCharges: pg.additionalCharges ?? '',
  rentIncludes: (pg.rentIncludes ?? []).join(', '),
  roomType: pg.roomType ?? '',
  bhk: pg.bhk?.toString() ?? '',
  genderPreference: pg.genderPreference ?? '',
  furnishing: pg.furnishing ?? '',
  totalRooms: pg.totalRooms?.toString() ?? '',
  availableRooms: pg.availableRooms?.toString() ?? '',
  isAvailable: pg.isAvailable !== false,
  amenities: pg.amenities ?? [],
  contactName: pg.contact?.name ?? '',
  contactPhone: pg.contact?.phone ?? '',
  ownerEmail: '',
  rules: (pg.rules ?? []).join('\n'),
});

/** Same checks as the database, so mistakes show next to the field instead of after saving */
function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {};
  const num = (v: string) => (v.trim() === '' ? NaN : Number(v));
  if (!f.title.trim()) e.title = 'Give the property a name.';
  if (!f.description.trim()) e.description = 'Add a short description.';
  if (!f.city.trim()) e.city = 'Choose a city.';
  if (!f.address.trim()) e.address = 'Add the full address.';
  if (!f.state.trim()) e.state = 'Add the state.';
  if (!/^\d{6}$/.test(f.pincode.trim())) e.pincode = 'Pincode is 6 digits.';
  if (!(num(f.rent) >= 0)) e.rent = 'Enter the monthly rent.';
  if (f.deposit && !(num(f.deposit) >= 0)) e.deposit = 'Deposit can’t be negative.';
  if (!f.genderPreference) e.genderPreference = 'Choose who can stay.';
  if (f.propertyType === 'pg' && !f.roomType) e.roomType = 'Choose a room type.';
  if (f.propertyType === 'flat' && !(num(f.bhk) >= 1 && num(f.bhk) <= 10)) e.bhk = 'BHK is 1 to 10.';
  if (!(num(f.totalRooms) >= 1)) e.totalRooms = 'At least 1.';
  if (!(num(f.availableRooms) >= 0)) e.availableRooms = 'Enter 0 or more.';
  else if (num(f.availableRooms) > num(f.totalRooms)) e.availableRooms = 'Can’t be more than the total.';
  if (f.lat && !(Math.abs(num(f.lat)) <= 90)) e.lat = 'Latitude is between -90 and 90.';
  if (f.lng && !(Math.abs(num(f.lng)) <= 180)) e.lng = 'Longitude is between -180 and 180.';
  if (f.contactPhone && !/^\+?[0-9]{10,15}$/.test(f.contactPhone.replace(/\s/g, ''))) e.contactPhone = '10 digits, e.g. 9876543210';
  if (f.ownerEmail && !/^\S+@\S+\.\S+$/.test(f.ownerEmail.trim())) e.ownerEmail = 'That doesn’t look like an email.';
  return e;
}

const toPayload = (f: Form) => {
  const list = (s: string, sep: RegExp) => s.split(sep).map((x) => x.trim()).filter(Boolean);
  const coords = f.lat && f.lng ? { lat: Number(f.lat), lng: Number(f.lng) } : undefined;
  return {
    propertyType: f.propertyType,
    title: f.title.trim(),
    description: f.description.trim(),
    location: {
      address: f.address.trim(),
      city: f.city.trim().toLowerCase(),
      locality: f.locality.trim() || undefined,
      state: f.state.trim(),
      pincode: f.pincode.trim(),
      ...(coords && { coordinates: coords }),
    },
    rent: Number(f.rent),
    deposit: f.deposit ? Number(f.deposit) : 0,
    additionalCharges: f.additionalCharges.trim(),
    rentIncludes: list(f.rentIncludes, /,/),
    genderPreference: f.genderPreference,
    ...(f.propertyType === 'pg' ? { roomType: f.roomType } : { bhk: Number(f.bhk) }),
    furnishing: f.furnishing || undefined,
    totalRooms: Number(f.totalRooms),
    availableRooms: Number(f.availableRooms),
    isAvailable: f.isAvailable,
    amenities: f.amenities,
    contact: { name: f.contactName.trim(), phone: f.contactPhone.replace(/\s/g, '') },
    rules: list(f.rules, /\n/),
    ...(f.ownerEmail.trim() && { ownerEmail: f.ownerEmail.trim().toLowerCase() }),
  };
};

/** Loads the listing (and the city list), then hands the form its starting values */
export function PropertyFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const listing = useQuery({ queryKey: ['admin-property', id], queryFn: () => adminApi.property(id!), enabled: Boolean(id) });
  const settings = useQuery({ queryKey: ['admin-settings'], queryFn: adminApi.settings, staleTime: 60_000 });

  if (id && listing.isError) {
    return (
      <Card>
        <EmptyState title="Listing not found" text="It may have been deleted." action={<Link to={`${ADMIN}/properties`}><Button>Back to properties</Button></Link>} />
      </Card>
    );
  }
  if ((id && listing.isPending) || settings.isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" aria-busy="true">
        <div className="skeleton h-[520px] rounded-xl" />
        <div className="skeleton h-[280px] rounded-xl" />
      </div>
    );
  }
  const initial: Form = listing.data
    ? fromListing(listing.data)
    : { ...EMPTY, propertyType: params.get('type') === 'flat' ? 'flat' : 'pg', city: settings.data?.cities?.[0] ?? '' };
  return <PropertyEditor key={id ?? 'new'} id={id} pg={listing.data} cityOptions={settings.data?.cities ?? []} initial={initial} />;
}

function PropertyEditor({ id, pg, cityOptions, initial }: { id?: string; pg?: AdminListing; cityOptions: string[]; initial: Form }) {
  const isNew = !id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { addToast } = useUIStore();

  const [form, setForm] = useState<Form>(initial);
  const [tried, setTried] = useState(false);
  const [queued, setQueued] = useState<File[]>([]); // photos picked before a new listing is saved
  const [saving, setSaving] = useState(false);

  const errors = useMemo(() => validate(form), [form]);
  const show = (k: keyof Form) => (tried ? errors[k] : undefined);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const text = (k: keyof Form) => ({
    id: `pf-${k}`,
    value: form[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never),
    'aria-invalid': Boolean(show(k)),
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (Object.keys(errors).length) {
      document.getElementById(`pf-${Object.keys(errors)[0]}`)?.focus();
      return;
    }
    setSaving(true);
    try {
      const body = toPayload(form);
      if (isNew) {
        const pg = await adminApi.createProperty(body);
        let failed = 0;
        for (const file of queued) {
          try {
            await adminApi.uploadPhotos(pg._id, [await compressImage(file)]);
          } catch {
            failed += 1;
          }
        }
        addToast({
          title: 'Property added',
          description: failed ? `${failed} photo${failed === 1 ? '' : 's'} didn’t upload. Try again below.` : 'It’s live in the app now.',
          variant: failed ? 'default' : 'success',
        });
        qc.invalidateQueries({ queryKey: ['admin-properties'] });
        qc.invalidateQueries({ queryKey: ['admin-overview'] });
        navigate(`${ADMIN}/properties/${pg._id}`, { replace: true });
      } else {
        const pg = await adminApi.updateProperty(id!, body);
        qc.setQueryData(['admin-property', id], (old: AdminListing | undefined) => ({ ...old, ...pg, owner: old?.owner ?? pg.owner }));
        setForm((f) => ({ ...f, ownerEmail: '' }));
        setTried(false);
        qc.invalidateQueries({ queryKey: ['admin-properties'] });
        addToast({ title: 'Changes saved', description: 'The app shows the new details now.', variant: 'success' });
      }
    } catch (err) {
      addToast({ title: 'Couldn’t save', description: errorText(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const cities = [...new Set([...cityOptions, ...(form.city ? [form.city.toLowerCase()] : [])])];

  return (
    <form onSubmit={save} noValidate>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <IconButton label="Back to properties" onClick={() => navigate(`${ADMIN}/properties`)}>
            <ArrowLeft className="h-4 w-4" />
          </IconButton>
          <div className="min-w-0">
            <h1 className="truncate font-display text-[22px] font-semibold tracking-tight">
              {isNew ? `Add a ${form.propertyType === 'flat' ? 'flat' : 'PG'}` : pg?.title || 'Edit property'}
            </h1>
            {pg && <p className="text-[12.5px] text-muted">Last changed {fmtDateTime(pg.updatedAt)}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate(`${ADMIN}/properties`)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {isNew ? 'Add property' : 'Save changes'}
          </Button>
        </div>
      </div>

      {(
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <Section title="Basics">
              <Field label="Property type">
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Property type">
                  {(['pg', 'flat'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={form.propertyType === t}
                      onClick={() => set('propertyType', t)}
                      className={cn(
                        'h-10 rounded-lg border text-[13.5px] font-medium transition-colors',
                        form.propertyType === t ? 'border-ink bg-ink text-white' : 'border-black/10 hover:bg-black/[0.03]'
                      )}
                    >
                      {t === 'pg' ? 'PG' : 'Flat'}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Property name" htmlFor="pf-title" error={show('title')}>
                <Input {...text('title')} maxLength={100} placeholder="e.g. Sunrise Girls PG" />
              </Field>
              <Field label="Description" htmlFor="pf-description" error={show('description')} hint={`${form.description.length}/2000`}>
                <Textarea {...text('description')} maxLength={2000} rows={4} placeholder="What students should know: rooms, food, who it suits." />
              </Field>
            </Section>

            <Section title="Location">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="City" htmlFor="pf-city" error={show('city')} hint="Add more cities in Settings">
                  <Select {...text('city')}>
                    <option value="">Choose a city</option>
                    {cities.map((c) => (
                      <option key={c} value={c}>
                        {titleCase(c)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Locality / area" htmlFor="pf-locality">
                  <Input {...text('locality')} maxLength={100} placeholder="e.g. Garali" />
                </Field>
              </div>
              <Field label="Full address" htmlFor="pf-address" error={show('address')}>
                <Input {...text('address')} placeholder="House, street, landmark" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="State" htmlFor="pf-state" error={show('state')}>
                  <Input {...text('state')} />
                </Field>
                <Field label="Pincode" htmlFor="pf-pincode" error={show('pincode')}>
                  <Input {...text('pincode')} inputMode="numeric" maxLength={6} />
                </Field>
                <Field label="Latitude" htmlFor="pf-lat" error={show('lat')} hint="Optional, for the map and “near college”">
                  <Input {...text('lat')} inputMode="decimal" placeholder="26.7509" />
                </Field>
                <Field label="Longitude" htmlFor="pf-lng" error={show('lng')}>
                  <Input {...text('lng')} inputMode="decimal" placeholder="94.2037" />
                </Field>
              </div>
            </Section>

            <Section title="Rent">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Monthly rent (₹)" htmlFor="pf-rent" error={show('rent')}>
                  <Input {...text('rent')} inputMode="numeric" placeholder="5000" />
                </Field>
                <Field label="Security deposit (₹)" htmlFor="pf-deposit" error={show('deposit')}>
                  <Input {...text('deposit')} inputMode="numeric" placeholder="0" />
                </Field>
              </div>
              <Field label="Rent includes" htmlFor="pf-rentIncludes" hint="Separate with commas, e.g. Electricity, Water">
                <Input {...text('rentIncludes')} />
              </Field>
              <Field label="Other charges" htmlFor="pf-additionalCharges">
                <Input {...text('additionalCharges')} placeholder="e.g. Electricity by meter" />
              </Field>
            </Section>

            <Section title="Rooms">
              <div className="grid gap-4 sm:grid-cols-2">
                {form.propertyType === 'pg' ? (
                  <Field label="Room type" htmlFor="pf-roomType" error={show('roomType')}>
                    <Select {...text('roomType')}>
                      <option value="">Choose</option>
                      {ROOM_TYPES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <Field label="BHK" htmlFor="pf-bhk" error={show('bhk')}>
                    <Input {...text('bhk')} inputMode="numeric" placeholder="2" />
                  </Field>
                )}
                <Field label="Who can stay" htmlFor="pf-genderPreference" error={show('genderPreference')}>
                  <Select {...text('genderPreference')}>
                    <option value="">Choose</option>
                    {GENDERS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={form.propertyType === 'pg' ? 'Total beds / rooms' : 'Total rooms'} htmlFor="pf-totalRooms" error={show('totalRooms')}>
                  <Input {...text('totalRooms')} inputMode="numeric" />
                </Field>
                <Field label="Available now" htmlFor="pf-availableRooms" error={show('availableRooms')}>
                  <Input {...text('availableRooms')} inputMode="numeric" />
                </Field>
                <Field label="Furnishing" htmlFor="pf-furnishing">
                  <Select {...text('furnishing')}>
                    <option value="">Not specified</option>
                    <option value="furnished">Furnished</option>
                    <option value="semi-furnished">Semi-furnished</option>
                    <option value="unfurnished">Unfurnished</option>
                  </Select>
                </Field>
                <div className="flex items-center justify-between gap-3 self-end rounded-lg border border-black/10 px-3 py-2">
                  <span className="text-[13px]">Taking tenants</span>
                  <Toggle label="Taking tenants" checked={form.isAvailable} onChange={(v) => set('isAvailable', v)} />
                </div>
              </div>
            </Section>

            <Section title="Amenities" description="Wi-Fi and meals are amenities too.">
              <div className="flex flex-wrap gap-2">
                {AMENITIES.map(({ value, label, icon: Icon }) => {
                  const on = form.amenities.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set('amenities', on ? form.amenities.filter((a) => a !== value) : [...form.amenities, value])}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] transition-colors',
                        on ? 'border-ink bg-ink text-white' : 'border-black/10 text-ink/75 hover:bg-black/[0.03]'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </button>
                  );
                })}
              </div>
              <Field label="House rules" htmlFor="pf-rules" hint="One per line">
                <Textarea {...text('rules')} rows={3} placeholder={'No smoking\nGate closes at 10 pm'} />
              </Field>
            </Section>

            <Section title="Contact" description="Shown to signed-in students instead of the account’s own details.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Contact person" htmlFor="pf-contactName">
                  <Input {...text('contactName')} maxLength={60} />
                </Field>
                <Field label="Contact number" htmlFor="pf-contactPhone" error={show('contactPhone')}>
                  <Input {...text('contactPhone')} inputMode="tel" placeholder="9876543210" />
                </Field>
              </div>
              <Field
                label={isNew ? 'Broker account (optional)' : 'Move to another broker (optional)'}
                htmlFor="pf-ownerEmail"
                error={show('ownerEmail')}
                hint={pg?.owner ? `Now: ${pg.owner.name || ''} ${pg.owner.email ? `(${pg.owner.email})` : ''}` : 'Their email. Leave blank to keep it under your account.'}
              >
                <Input {...text('ownerEmail')} type="email" placeholder="broker@email.com" />
              </Field>
            </Section>
          </div>

          <div className="space-y-4 lg:sticky lg:top-6">
            {pg && <StatusCard pg={pg} />}
            <PhotosCard pg={pg} queued={queued} onQueue={setQueued} />
          </div>
        </div>
      )}
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="space-y-4 px-5 py-5">{children}</div>
    </Card>
  );
}

function StatusCard({ pg }: { pg: AdminListing }) {
  const { action, remove } = usePropertyActions();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<'delete' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const state = listingState(pg);
  const run = (a: string) => action.mutate({ id: pg._id, action: a });

  return (
    <Card>
      <CardHeader
        title="Status"
        action={
          <a href={`/pg/${pg._id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink" title="Opens in the main app (when the site is public)">
            View <ExternalLink className="h-3.5 w-3.5" />
          </a>
        }
      />
      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={state.tone}>{state.label}</Badge>
          {pg.isVerified && (
            <Badge tone="blue">
              <BadgeCheck className="h-3.5 w-3.5" /> Verified
            </Badge>
          )}
        </div>
        {pg.status === 'rejected' && pg.rejectionReason && <p className="text-[12.5px] text-muted">Reason: {pg.rejectionReason}</p>}

        {(pg.status === 'pending' || pg.status === 'rejected') && (
          <div className="flex gap-2">
            <Button size="sm" variant="primary" icon={<Check className="h-3.5 w-3.5" />} onClick={() => run('approve')} loading={action.isPending && action.variables?.action === 'approve'}>
              Approve
            </Button>
            {pg.status === 'pending' && (
              <Button size="sm" icon={<X className="h-3.5 w-3.5" />} onClick={() => setConfirm('reject')}>
                Reject
              </Button>
            )}
          </div>
        )}

        <div className="divide-y divide-black/[0.06] rounded-lg border border-black/[0.08]">
          <Row label="Visible to students" hint={pg.isActive === false ? 'Hidden' : 'Shown'}>
            <Toggle label="Visible to students" checked={pg.isActive !== false} disabled={action.isPending} onChange={(v) => run(v ? 'activate' : 'deactivate')} />
          </Row>
          <Row label="Verified by anieghar" hint="Checked in person">
            <Toggle label="Verified by anieghar" checked={Boolean(pg.isVerified)} disabled={action.isPending} onChange={(v) => run(v ? 'verify' : 'unverify')} />
          </Row>
        </div>

        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            ['Views', pg.analytics?.views],
            ['Saves', pg.analytics?.saves],
            ['Requests', pg.analytics?.inquiries],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-lg bg-black/[0.025] py-2">
              <dt className="text-[11.5px] text-muted">{l}</dt>
              <dd className="text-[15px] font-semibold tabular-nums">{(v as number) ?? 0}</dd>
            </div>
          ))}
        </dl>

        <Button variant="ghost" size="sm" className="w-full text-red-600 hover:bg-red-50 hover:text-red-700" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setConfirm('delete')}>
          Delete listing
        </Button>
      </div>

      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        loading={remove.isPending}
        onConfirm={() => remove.mutate(pg._id, { onSuccess: () => navigate(`${ADMIN}/properties`, { replace: true }) })}
        title="Delete this listing?"
        confirmLabel="Delete listing"
        body={
          <>
            <strong className="font-medium text-ink">{pg.title}</strong> will be removed from anieghar for good. To hide it for now, turn off “Visible to students” instead.
          </>
        }
      />
      <ConfirmDialog
        open={confirm === 'reject'}
        onClose={() => setConfirm(null)}
        loading={action.isPending}
        onConfirm={() => action.mutate({ id: pg._id, action: 'reject', reason }, { onSuccess: () => setConfirm(null) })}
        title="Reject this listing?"
        confirmLabel="Reject listing"
        body={<>Students won’t see it. If the broker edits it, it comes back for review.</>}
      >
        <Field label="Reason" className="mt-4" htmlFor="pf-reject-reason">
          <Textarea id="pf-reject-reason" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </ConfirmDialog>
    </Card>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div>
        <p className="text-[13px]">{label}</p>
        <p className="text-[11.5px] text-muted">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function PhotosCard({ pg, queued, onQueue }: { pg?: AdminListing; queued: File[]; onQueue: (f: File[]) => void }) {
  const qc = useQueryClient();
  const { addToast } = useUIStore();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const previews = useMemo(() => queued.map((f) => URL.createObjectURL(f)), [queued]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  const refresh = (next: AdminListing) => {
    qc.setQueryData(['admin-property', pg!._id], (old: AdminListing | undefined) => ({ ...old, ...next, owner: old?.owner ?? next.owner }));
    qc.invalidateQueries({ queryKey: ['admin-properties'] });
  };
  const del = useMutation({
    mutationFn: (publicId: string) => adminApi.deletePhoto(pg!._id, publicId),
    onSuccess: (next) => {
      refresh(next);
      setToDelete(null);
      addToast({ title: 'Photo deleted', variant: 'success' });
    },
    onError: (err) => addToast({ title: 'Couldn’t delete the photo', description: errorText(err), variant: 'destructive' }),
  });
  const cover = useMutation({
    mutationFn: (publicId: string) => adminApi.reorderPhotos(pg!._id, [publicId, ...pg!.images.map((i) => i.publicId).filter((p) => p !== publicId)]),
    onSuccess: (next) => {
      refresh(next);
      addToast({ title: 'Cover photo changed', variant: 'success' });
    },
    onError: (err) => addToast({ title: 'Couldn’t change the cover', description: errorText(err), variant: 'destructive' }),
  });

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    const bad = list.filter((f) => !isAllowedPhoto(f));
    const good = list.filter(isAllowedPhoto);
    if (bad.length) addToast({ title: `${bad.length} file${bad.length === 1 ? '' : 's'} skipped`, description: `Use JPG, PNG or WEBP under ${MAX_PHOTO_MB} MB.`, variant: 'destructive' });
    if (input.current) input.current.value = '';
    if (!pg) {
      onQueue([...queued, ...good].slice(0, 10));
      return;
    }
    // One at a time: each request stays small enough for the host's upload limit
    setUploading(good.length);
    let latest: AdminListing | null = null;
    let failed = 0;
    for (const file of good) {
      try {
        latest = await adminApi.uploadPhotos(pg._id, [await compressImage(file)]);
      } catch {
        failed += 1;
      }
      setUploading((n) => n - 1);
    }
    if (latest) refresh(latest);
    addToast(
      failed
        ? { title: `${failed} photo${failed === 1 ? '' : 's'} didn’t upload`, description: 'Check your connection and try again.', variant: 'destructive' }
        : { title: `${good.length} photo${good.length === 1 ? '' : 's'} added`, variant: 'success' }
    );
  };

  const images = pg?.images ?? [];
  return (
    <Card>
      <CardHeader title="Photos" description={pg ? 'The first photo is the cover.' : 'Uploaded when you add the property.'} />
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, i) => (
            <div key={img.publicId} className="group relative aspect-square overflow-hidden rounded-lg bg-black/[0.04]">
              <img src={img.url} alt={`Photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-ink/80 px-1.5 py-px text-[10.5px] font-medium text-white">Cover</span>}
              <div className="absolute inset-x-1 bottom-1 flex justify-end gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                {i > 0 && (
                  <IconButton label="Make cover photo" className="h-7 w-7 bg-white/95 shadow" onClick={() => cover.mutate(img.publicId)}>
                    <Star className="h-3.5 w-3.5" />
                  </IconButton>
                )}
                <IconButton label="Delete photo" className="h-7 w-7 bg-white/95 text-red-600 shadow hover:text-red-700" onClick={() => setToDelete(img.publicId)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            </div>
          ))}
          {previews.map((src, i) => (
            <div key={src} className="relative aspect-square overflow-hidden rounded-lg bg-black/[0.04]">
              <img src={src} alt="" className="h-full w-full object-cover" />
              <IconButton label="Remove photo" className="absolute right-1 top-1 h-7 w-7 bg-white/95 shadow" onClick={() => onQueue(queued.filter((_, j) => j !== i))}>
                <X className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            <div key={`up-${i}`} className="skeleton aspect-square rounded-lg" />
          ))}
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-black/15 text-[12px] text-muted transition-colors hover:border-black/30 hover:text-ink"
          >
            <ImagePlus className="h-5 w-5" />
            Add
          </button>
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => pick(e.target.files)} />
      </div>
      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        loading={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete)}
        title="Delete this photo?"
        confirmLabel="Delete photo"
        body="The photo is removed from the listing and from storage. This can’t be undone."
      />
    </Card>
  );
}
