import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, BedDouble, Building2, Check, ImagePlus, Loader2, MapPin } from 'lucide-react';
import { useCreatePG, useDeleteImage, usePGListing, useUpdatePG, useUploadImages } from '@/hooks/usePG';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ds/Button';
import { Chip } from '@/components/ds/Chip';
import { Field, TextArea } from '@/components/ds/Field';
import { LocationPicker, type LocationResult } from '@/components/maps/LocationPicker';
import { AMENITIES, GENDERS, ROOM_TYPES } from '@/components/listing/meta';
import { PhotoTile } from '@/components/dashboard/PhotoTile';
import { MAX_NEW_PHOTOS, MAX_PHOTO_MB, PHOTO_TYPES, isAllowedPhoto } from '@/components/dashboard/photoRules';
import type { CreatePGPayload, PGListing } from '@/types';

const RENT_INCLUDES = [
  { value: 'meals', label: 'Meals' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'water', label: 'Water' },
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'gas', label: 'Gas' },
  { value: 'housekeeping', label: 'Housekeeping' },
];

const STEPS = ['Basics & photos', 'Location', 'Rent & rooms', 'Facilities'];

// Room type and BHK always have a value (set when the type is picked), so no cross-field
// refine is needed — object-level checks only run once every field is valid, i.e. too late.
const schema = z.object({
  propertyType: z.enum(['pg', 'flat']),
  title: z.string().trim().min(5, 'At least 5 characters').max(100, 'Keep it under 100 characters'),
  description: z
    .string()
    .trim()
    .min(20, 'Tell students a bit more (at least 20 characters)')
    .max(2000, 'Keep it under 2000 characters'),
  address: z.string().trim().min(3, 'Add the street or area'),
  city: z.string().trim().min(2, 'Add the city'),
  state: z.string().trim().min(2, 'Add the state'),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit pincode'),
  lat: z.number().optional(),
  lng: z.number().optional(),
  rent: z.coerce.number({ message: 'Enter the monthly rent' }).min(500, 'At least ₹500').max(500000, 'That looks too high'),
  deposit: z.coerce.number({ message: 'Enter the deposit (0 if none)' }).min(0, 'Can’t be negative'),
  genderPreference: z.enum(['male', 'female', 'any']),
  roomType: z.enum(['single', 'double', 'triple', 'dormitory']),
  bhk: z.number().int().min(1).max(10),
  totalRooms: z.coerce.number({ message: 'Enter a number' }).int().min(1, 'At least 1'),
  availableRooms: z.coerce.number({ message: 'Enter a number' }).int().min(0, 'Can’t be negative'),
  amenities: z.array(z.string()).min(1, 'Pick at least one'),
  rentIncludes: z.array(z.string()),
  additionalCharges: z.string().max(300, 'Keep it under 300 characters').optional(),
});
type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

const stepFields: (keyof FormData)[][] = [
  ['propertyType', 'title', 'description'],
  ['address', 'city', 'state', 'pincode'],
  ['rent', 'deposit', 'genderPreference', 'roomType', 'bhk', 'totalRooms', 'availableRooms', 'rentIncludes', 'additionalCharges'],
  ['amenities'],
];

const EMPTY: FormInput = {
  propertyType: 'pg',
  title: '',
  description: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  lat: undefined,
  lng: undefined,
  rent: '',
  deposit: '',
  genderPreference: 'any',
  roomType: 'single',
  bhk: 1,
  totalRooms: '',
  availableRooms: '',
  amenities: [],
  rentIncludes: [],
  additionalCharges: '',
};

const toFormValues = (pg: PGListing): FormInput => ({
  propertyType: pg.propertyType ?? 'pg',
  title: pg.title,
  description: pg.description,
  address: pg.location.address,
  city: pg.location.city,
  state: pg.location.state,
  pincode: pg.location.pincode,
  lat: pg.location.coordinates?.lat,
  lng: pg.location.coordinates?.lng,
  rent: pg.rent,
  deposit: pg.deposit,
  genderPreference: pg.genderPreference,
  roomType: pg.roomType ?? 'single',
  bhk: pg.bhk ?? 1,
  totalRooms: pg.totalRooms,
  availableRooms: pg.availableRooms,
  amenities: pg.amenities,
  rentIncludes: pg.rentIncludes ?? [],
  additionalCharges: pg.additionalCharges ?? '',
});

interface NewPhoto {
  file: File;
  url: string;
}

export function NewPGPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { data: existingData, isLoading: loadingExisting } = usePGListing(id ?? '');
  const existing = existingData?.data?.pg;

  const createPG = useCreatePG();
  const updatePG = useUpdatePG();
  const uploadImages = useUploadImages();
  const deleteImage = useDeleteImage();
  const { addToast } = useUIStore();

  const [step, setStep] = useState(0);
  const [visited, setVisited] = useState(0);
  const maxVisited = isEdit ? STEPS.length - 1 : visited; // every step is open when editing
  const [photos, setPhotos] = useState<NewPhoto[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isSubmitting = createPG.isPending || updatePG.isPending || uploadImages.isPending;

  const {
    register,
    control,
    handleSubmit,
    trigger,
    reset,
    setValue,
    getValues,
    setError,
    getFieldState,
    subscribe,
    formState: { errors },
  } = useForm<FormInput, unknown, FormData>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  // Steps are checked with trigger(), not a submit, so RHF won't re-check a field as it's edited —
  // an error from "Continue" would linger after it's fixed. Re-check any field that's showing one.
  useEffect(
    () =>
      subscribe({
        formState: { values: true },
        callback: ({ name }) => {
          const field = name as keyof FormInput | undefined;
          if (field && getFieldState(field).error) void trigger(field);
        },
      }),
    [subscribe, getFieldState, trigger]
  );

  const propertyType = useWatch({ control, name: 'propertyType' });
  const lat = useWatch({ control, name: 'lat' });
  const lng = useWatch({ control, name: 'lng' });
  const isFlat = propertyType === 'flat';

  // Fill the form once per listing — later refetches (e.g. after deleting a photo) must not wipe edits
  const loadedId = useRef<string | null>(null);
  useEffect(() => {
    if (existing && loadedId.current !== existing._id) {
      loadedId.current = existing._id;
      reset(toFormValues(existing));
    }
  }, [existing, reset]);

  // Free preview URLs when leaving the page
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  // Block closing the tab mid-save
  useEffect(() => {
    if (!isSubmitting) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isSubmitting]);

  const existingImages = (existing?.images ?? []).filter((img) => !removedIds.has(img.publicId));

  /** Fields valid + the one check that spans two fields */
  const stepIsValid = async (index: number) => {
    const valid = await trigger(stepFields[index]);
    if (!valid) return false;
    if (index === 2 && !isFlat) {
      const { totalRooms, availableRooms } = getValues();
      if (Number(availableRooms) > Number(totalRooms)) {
        setError('availableRooms', { message: 'Can’t be more than the total' });
        return false;
      }
    }
    return true;
  };

  const goToStep = async (target: number) => {
    if (isSubmitting || target === step || target > maxVisited) return;
    if (target > step && !(await stepIsValid(step))) return;
    setStep(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const next = async () => {
    if (!(await stepIsValid(step))) return;
    const target = Math.min(step + 1, STEPS.length - 1);
    setStep(target);
    setVisited((v) => Math.max(v, target));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const choosePropertyType = (type: 'pg' | 'flat') => {
    setValue('propertyType', type, { shouldValidate: true });
    if (type === 'flat') {
      // A flat is one unit: available (1) or rented out (0)
      setValue('totalRooms', 1);
      setValue('availableRooms', 1);
    }
  };

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const accepted: NewPhoto[] = [];
    let rejected = 0;
    for (const file of Array.from(files)) {
      if (!isAllowedPhoto(file)) rejected += 1;
      else accepted.push({ file, url: URL.createObjectURL(file) });
    }
    const room = MAX_NEW_PHOTOS - photos.length;
    accepted.slice(room).forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos((prev) => [...prev, ...accepted.slice(0, room)]);
    if (rejected) {
      addToast({ title: `${rejected} file${rejected > 1 ? 's' : ''} skipped`, description: `Use JPG, PNG or WEBP under ${MAX_PHOTO_MB} MB.`, variant: 'destructive' });
    } else if (accepted.length > room) {
      addToast({ title: `You can add up to ${MAX_NEW_PHOTOS} photos at a time`, variant: 'destructive' });
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const deleteExisting = async (publicId: string) => {
    if (!id) return;
    setDeletingId(publicId);
    try {
      await deleteImage.mutateAsync({ id, publicId });
      setRemovedIds((prev) => new Set(prev).add(publicId));
    } catch {
      addToast({ title: 'Couldn’t delete that photo', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const onSubmit = async (data: FormData) => {
    // Earlier steps may have changed since they were checked
    for (let i = 0; i < STEPS.length - 1; i++) {
      if (!(await stepIsValid(i))) {
        setStep(i);
        return;
      }
    }

    const payload: CreatePGPayload = {
      propertyType: data.propertyType,
      title: data.title,
      description: data.description,
      location: {
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        ...(data.lat !== undefined && data.lng !== undefined ? { coordinates: { lat: data.lat, lng: data.lng } } : {}),
      },
      rent: data.rent,
      deposit: data.deposit,
      genderPreference: data.genderPreference,
      ...(data.propertyType === 'flat' ? { bhk: data.bhk } : { roomType: data.roomType }),
      totalRooms: data.propertyType === 'flat' ? 1 : data.totalRooms,
      availableRooms: data.propertyType === 'flat' ? Math.min(data.availableRooms, 1) : data.availableRooms,
      amenities: data.amenities,
      rentIncludes: data.rentIncludes,
      additionalCharges: data.additionalCharges ?? '',
    };

    const uploadPhotos = async (pgId: string) => {
      if (photos.length === 0) return true;
      try {
        await uploadImages.mutateAsync({ id: pgId, files: photos.map((p) => p.file) });
        return true;
      } catch (err) {
        const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        addToast({ title: 'Photos didn’t upload', description: message ?? 'You can add them again from Edit.', variant: 'destructive' });
        return false;
      }
    };

    try {
      if (isEdit && id) {
        await updatePG.mutateAsync({ id, payload });
        const ok = await uploadPhotos(id);
        if (ok) addToast({ title: 'Changes saved', variant: 'success' });
      } else {
        const res = await createPG.mutateAsync(payload);
        const ok = await uploadPhotos(res.data?.pg?._id);
        if (ok) addToast({ title: 'Your listing is live', description: 'Students can find it now.', variant: 'success' });
      }
      navigate('/dashboard/listings');
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      addToast({ title: 'Couldn’t save the listing', description: message, variant: 'destructive' });
    }
  };

  if (isEdit && loadingExisting) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 animate-pulse rounded-2xl bg-surface" />
        <div className="h-[480px] animate-pulse rounded-[28px] bg-surface" />
      </div>
    );
  }

  const photoCount = existingImages.length + photos.length;

  return (
    <>
      {isSubmitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
          <div className="flex items-center gap-4 rounded-[24px] bg-white px-6 py-5 font-display shadow-2xl">
            <Loader2 className="h-6 w-6 animate-spin" />
            <div>
              <p className="text-sm font-semibold">
                {uploadImages.isPending ? `Uploading ${photos.length} photo${photos.length === 1 ? '' : 's'}…` : isEdit ? 'Saving your changes…' : 'Publishing your listing…'}
              </p>
              <p className="text-[13px] text-muted">Please keep this page open</p>
            </div>
          </div>
        </div>
      )}

      {/* Laptops: the steps sit in a column on the left and the form fills the rest of the width */}
      <div className="animate-fade-in lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-10 xl:grid-cols-[280px_minmax(0,1fr)] xl:gap-14">
        <div className="lg:sticky lg:top-24">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={isSubmitting}
            className="mb-5 flex h-11 items-center gap-2 rounded-2xl bg-surface pl-3 pr-4 text-sm font-medium transition-colors hover:bg-[#ebebee] disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          <p className="text-[13px] text-muted">
            Step {step + 1} of {STEPS.length}
          </p>
          <h1 className="mt-0.5 text-[28px] font-semibold tracking-tight">{isEdit ? 'Edit listing' : 'Add a listing'}</h1>

          {/* Stepper */}
          <ol className="scrollbar-hide -mx-4 mt-5 flex items-center gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:mt-6 lg:flex-col lg:items-stretch lg:gap-0 lg:overflow-visible">
            {STEPS.map((label, i) => {
              const done = i < step || (i <= maxVisited && i !== step);
              return (
                <li key={label} className="flex shrink-0 items-center gap-1.5 lg:flex-col lg:items-stretch lg:gap-0">
                  <button
                    type="button"
                    onClick={() => goToStep(i)}
                    disabled={i > maxVisited || isSubmitting}
                    aria-current={i === step ? 'step' : undefined}
                    className={cn(
                      'flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-[13px] font-medium transition-colors lg:w-full lg:py-2',
                      i === step ? 'bg-ink text-white' : i <= maxVisited ? 'bg-surface hover:bg-[#ebebee]' : 'text-muted'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                        i === step ? 'bg-white text-ink' : done ? 'bg-ink text-white' : 'bg-surface text-muted'
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                    </span>
                    {label}
                  </button>
                  {i < STEPS.length - 1 && <span className="h-px w-3 bg-black/10 lg:ml-[18px] lg:h-3 lg:w-px" />}
                </li>
              );
            })}
          </ol>
        </div>

        <form
          id="pg-form"
          onSubmit={handleSubmit(onSubmit, (fieldErrors) => {
            // e.g. editing an older listing: take them to the step that needs fixing
            const first = stepFields.findIndex((fields) => fields.some((f) => fieldErrors[f]));
            if (first >= 0) setStep(first);
            addToast({ title: 'A few details need fixing', variant: 'destructive' });
          })}
          // Enter in a text field shouldn't publish half a listing
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
          }}
          className="mt-6 lg:mt-0"
        >
          <section className="rounded-[28px] border border-black/[0.06] bg-white p-5 sm:p-8">
            {/* ── 1. Basics & photos ── */}
            {step === 0 && (
              <div className="space-y-6">
                <div>
                  <p className="mb-2.5 text-[13px] font-medium">What are you listing?</p>
                  <div role="radiogroup" aria-label="Listing type" className="grid grid-cols-2 gap-3">
                    {(
                      [
                        ['pg', 'PG', 'Rooms or beds, shared or single', BedDouble],
                        ['flat', 'Flat', 'A whole apartment', Building2],
                      ] as const
                    ).map(([value, title, text, Icon]) => {
                      const selected = propertyType === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          id={`pg-type-${value}`}
                          onClick={() => choosePropertyType(value)}
                          className={cn(
                            'relative flex flex-col items-start gap-3 rounded-[22px] border p-4 text-left transition-all',
                            selected ? 'border-ink shadow-[0_14px_30px_-16px_rgba(17,17,17,0.45)]' : 'border-black/[0.07] hover:border-black/20'
                          )}
                        >
                          <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', selected ? 'bg-ink text-white' : 'bg-surface')}>
                            <Icon className="h-5 w-5" />
                          </span>
                          <span>
                            <span className="block text-sm font-semibold">{title}</span>
                            <span className="mt-0.5 block text-xs text-muted">{text}</span>
                          </span>
                          <span
                            className={cn(
                              'absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-md border',
                              selected ? 'border-accent bg-accent text-white' : 'border-black/15'
                            )}
                          >
                            {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Photos are on the first screen so brokers add them while listing, not after publishing */}
                <div className="space-y-4">
                <div>
                  <p className="text-[13px] font-medium">Photos</p>
                  <p className="mt-0.5 text-[13px] text-muted">Real photos of the rooms, kitchen and building. The first one is the cover.</p>
                </div>

                {photoCount > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {existingImages.map((img, i) => (
                      <PhotoTile
                        key={img.publicId}
                        src={img.url}
                        cover={i === 0}
                        busy={deletingId === img.publicId}
                        label="Delete photo"
                        onRemove={() => deleteExisting(img.publicId)}
                        disabled={deletingId !== null}
                      />
                    ))}
                    {photos.map((p, i) => (
                      <PhotoTile
                        key={p.url}
                        src={p.url}
                        cover={existingImages.length === 0 && i === 0}
                        isNew
                        label="Remove photo"
                        onRemove={() => removePhoto(i)}
                      />
                    ))}
                  </div>
                )}

                <label
                  htmlFor="pg-images"
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-black/10 bg-surface/60 px-6 py-8 text-center transition-colors hover:border-black/25"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white">
                    <ImagePlus className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold">{photoCount ? 'Add more photos' : 'Add photos'}</span>
                  <span className="text-[13px] text-muted">JPG, PNG or WEBP · up to {MAX_PHOTO_MB} MB each</span>
                  <input
                    id="pg-images"
                    type="file"
                    accept={PHOTO_TYPES.join(',')}
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      addPhotos(e.target.files);
                      e.target.value = ''; // allow picking the same file again
                    }}
                  />
                </label>

                {photoCount === 0 && (
                  <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                    Listings with photos get far more requests. You can also add them later from My listings.
                  </p>
                )}
                </div>
                <Field
                  id="pg-title"
                  label="Title"
                  placeholder={isFlat ? 'e.g. Furnished 2BHK near AAU gate' : 'e.g. Sunrise Girls PG near Kaziranga University'}
                  error={errors.title?.message}
                  {...register('title')}
                />
                <TextArea
                  id="pg-description"
                  label="Description"
                  rows={6}
                  placeholder="What’s nearby (colleges, market, bus stop), the rooms, food, house rules, visiting hours…"
                  error={errors.description?.message}
                  {...register('description')}
                />
              </div>
            )}

            {/* ── 2. Location ── */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <p className="mb-1 text-[13px] font-medium">Pin it on the map</p>
                  <p className="mb-3 text-[13px] text-muted">Students searching “near my college” only see places with a pin.</p>
                  <LocationPicker
                    value={{ lat, lng }}
                    onChange={(r: LocationResult) => {
                      // Only overwrite fields the lookup actually returned
                      if (r.address) setValue('address', r.address, { shouldValidate: true });
                      if (r.city) setValue('city', r.city, { shouldValidate: true });
                      if (r.state) setValue('state', r.state, { shouldValidate: true });
                      if (r.pincode) setValue('pincode', r.pincode, { shouldValidate: true });
                      setValue('lat', r.lat);
                      setValue('lng', r.lng);
                    }}
                  />
                </div>
                <div className="space-y-4 rounded-[22px] bg-surface/60 p-4 sm:p-5">
                  <p className="flex items-center gap-2 text-[13px] font-medium">
                    <MapPin className="h-4 w-4" /> Address students will see
                  </p>
                  <Field id="pg-address" label="Street / area" placeholder="House no., street, area or landmark" error={errors.address?.message} {...register('address')} />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field id="pg-city" label="City" placeholder="Jorhat" error={errors.city?.message} {...register('city')} />
                    <Field id="pg-state" label="State" placeholder="Assam" error={errors.state?.message} {...register('state')} />
                    <Field id="pg-pincode" label="Pincode" placeholder="785001" inputMode="numeric" maxLength={6} error={errors.pincode?.message} {...register('pincode')} />
                  </div>
                  {lat === undefined && (
                    <p className="rounded-2xl bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900">
                      Not pinned yet — you can still continue, but it won’t show up in college searches.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── 3. Rent & rooms ── */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="pg-rent" label="Monthly rent (₹)" type="number" inputMode="numeric" placeholder="6000" error={errors.rent?.message} {...register('rent')} />
                  <Field id="pg-deposit" label="Security deposit (₹)" type="number" inputMode="numeric" placeholder="0 if none" error={errors.deposit?.message} {...register('deposit')} />
                </div>

                <ChipGroup label="Who can stay">
                  <Controller
                    control={control}
                    name="genderPreference"
                    render={({ field }) => (
                      <>
                        {GENDERS.map((g) => (
                          <Chip key={g.value} id={`pg-gender-${g.value}`} selected={field.value === g.value} onClick={() => field.onChange(g.value)}>
                            {g.value === 'any' && isFlat ? 'Anyone' : g.label}
                          </Chip>
                        ))}
                      </>
                    )}
                  />
                </ChipGroup>

                {isFlat ? (
                  <>
                    <ChipGroup label="Size">
                      <Controller
                        control={control}
                        name="bhk"
                        render={({ field }) => (
                          <>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Chip key={n} id={`pg-bhk-${n}`} selected={field.value === n} onClick={() => field.onChange(n)}>
                                {n} BHK
                              </Chip>
                            ))}
                          </>
                        )}
                      />
                    </ChipGroup>
                    <Controller
                      control={control}
                      name="availableRooms"
                      render={({ field }) => {
                        const available = Number(field.value) > 0;
                        return (
                          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-surface px-4 py-3.5">
                            <span>
                              <span className="block text-sm font-medium">Available to rent now</span>
                              <span className="block text-[13px] text-muted">Turn off once it’s rented out</span>
                            </span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={available}
                              id="pg-flat-available"
                              onClick={() => field.onChange(available ? 0 : 1)}
                              className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', available ? 'bg-ink' : 'bg-black/15')}
                            >
                              <span className={cn('absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', available ? 'translate-x-[22px]' : 'translate-x-0.5')} />
                            </button>
                          </label>
                        );
                      }}
                    />
                  </>
                ) : (
                  <>
                    <ChipGroup label="Room sharing">
                      <Controller
                        control={control}
                        name="roomType"
                        render={({ field }) => (
                          <>
                            {ROOM_TYPES.map((r) => (
                              <Chip key={r.value} id={`pg-room-${r.value}`} selected={field.value === r.value} onClick={() => field.onChange(r.value)}>
                                {r.label}
                              </Chip>
                            ))}
                          </>
                        )}
                      />
                    </ChipGroup>
                    <div className="grid grid-cols-2 gap-4">
                      <Field id="pg-total-rooms" label="Total rooms" type="number" inputMode="numeric" placeholder="10" error={errors.totalRooms?.message} {...register('totalRooms')} />
                      <Field id="pg-available-rooms" label="Rooms free now" type="number" inputMode="numeric" placeholder="3" error={errors.availableRooms?.message} {...register('availableRooms')} />
                    </div>
                  </>
                )}

                <ChipGroup label="Included in the rent" hint="Leave all off if nothing is included — students will see that clearly.">
                  <Controller
                    control={control}
                    name="rentIncludes"
                    render={({ field }) => (
                      <>
                        {RENT_INCLUDES.map((opt) => {
                          const selected = field.value.includes(opt.value);
                          return (
                            <Chip
                              key={opt.value}
                              id={`rent-includes-${opt.value}`}
                              selected={selected}
                              onClick={() => field.onChange(selected ? field.value.filter((v) => v !== opt.value) : [...field.value, opt.value])}
                            >
                              {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                              {opt.label}
                            </Chip>
                          );
                        })}
                      </>
                    )}
                  />
                </ChipGroup>

                <TextArea
                  id="pg-additional-charges"
                  label="Extra charges (optional)"
                  rows={2}
                  placeholder="e.g. Electricity as per meter, ₹200/month for water"
                  error={errors.additionalCharges?.message}
                  {...register('additionalCharges')}
                />
              </div>
            )}

            {/* ── 4. Facilities ── */}
            {step === 3 && (
              <div>
                <p className="text-[13px] font-medium">Choose facilities</p>
                <p className="mb-4 mt-0.5 text-[13px] text-muted">Only pick what’s actually there — students filter by these.</p>
                <Controller
                  control={control}
                  name="amenities"
                  render={({ field }) => (
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {AMENITIES.map(({ value, label, icon: Icon }) => {
                        const checked = field.value.includes(value);
                        return (
                          <button
                            key={value}
                            type="button"
                            role="checkbox"
                            aria-checked={checked}
                            id={`amenity-${value}`}
                            onClick={() => field.onChange(checked ? field.value.filter((a) => a !== value) : [...field.value, value])}
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
                  )}
                />
                {errors.amenities && <p className="mt-3 text-xs text-red-500">{errors.amenities.message}</p>}
              </div>
            )}

          </section>

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => goToStep(step - 1)} disabled={step === 0 || isSubmitting}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button id="pg-next-btn" onClick={next} disabled={isSubmitting}>
                Continue
              </Button>
            ) : (
              <Button type="submit" id="pg-submit-btn" loading={isSubmitting}>
                {isEdit ? 'Save changes' : photos.length ? `Publish with ${photos.length} photo${photos.length === 1 ? '' : 's'}` : 'Publish listing'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}

function ChipGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 text-[13px] font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  );
}

