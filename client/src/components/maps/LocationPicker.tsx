/// <reference types="google.maps" />
/**
 * LocationPicker — pins a listing's location for the Add/Edit listing form.
 *
 * With a Google Maps key: Places autocomplete (addresses, landmarks, Plus Codes), GPS,
 * and a draggable marker. Without one: OpenStreetMap search (free, no key), GPS and a
 * map preview — so brokers can always set coordinates, which the "near college" search needs.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
  type MapMouseEvent,
} from '@vis.gl/react-google-maps';
import { Loader2, MapPin, Navigation, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonClasses, inputClasses } from '@/components/ds/styles';

export interface LocationResult {
  address: string;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
}

interface LocationPickerProps {
  value?: { lat?: number; lng?: number };
  onChange: (result: LocationResult) => void;
  className?: string;
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const mapsEnabled = Boolean(API_KEY && API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE');

export function LocationPicker(props: LocationPickerProps) {
  return mapsEnabled ? <GoogleLocationPicker {...props} /> : <OsmLocationPicker {...props} />;
}

const searchInputClass = cn(inputClasses, 'h-12 pl-11 pr-10');
const dropdownClass =
  'absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_20px_50px_-20px_rgba(17,17,17,0.35)]';

function GpsButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title="Use my current location"
      className={buttonClasses('secondary', 'md', 'px-4')}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
      <span className="hidden sm:inline">Use my location</span>
    </button>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-[13px] text-red-700">{children}</p>;
}

function geolocate(onPosition: (lat: number, lng: number) => void, onError: (message: string) => void) {
  if (!navigator.geolocation) {
    onError('Your browser can’t share its location.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => onPosition(coords.latitude, coords.longitude),
    (err) =>
      onError(
        err.code === err.PERMISSION_DENIED
          ? 'Location access is blocked. Allow it in your browser settings, or search instead.'
          : 'Couldn’t get your location. Search for the address instead.'
      ),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

/* ─── Without a Google key: OpenStreetMap (Nominatim) ─────────────────── */

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string>;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org';

function fromNominatim(r: NominatimResult): LocationResult {
  const a = r.address ?? {};
  const road = a.house_number && a.road ? `${a.house_number} ${a.road}` : a.road;
  const place = r.name && r.name !== a.road ? r.name : '';
  const locality = a.suburb || a.neighbourhood || a.quarter || a.hamlet || '';
  return {
    address: [place, road, locality].filter(Boolean).join(', ') || r.display_name.split(',').slice(0, 2).join(','),
    city: a.city || a.town || a.village || a.state_district || a.county || '',
    state: a.state || '',
    pincode: (a.postcode || '').replace(/\s/g, '').slice(0, 6),
    lat: Number(r.lat),
    lng: Number(r.lon),
  };
}

function OsmLocationPicker({ value, onChange, className }: LocationPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const picked = useRef('');

  // Debounced — OpenStreetMap's free service allows about one request a second
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || q === picked.current) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q, format: 'jsonv2', addressdetails: '1', countrycodes: 'in', limit: '5', 'accept-language': 'en' });
        const res = await fetch(`${NOMINATIM}/search?${params}`, { signal: controller.signal });
        setResults(await res.json());
        setOpen(true);
        setError('');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError('Search isn’t working right now. Type the address in the fields below.');
      } finally {
        setSearching(false);
      }
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const pick = (r: NominatimResult) => {
    picked.current = r.display_name;
    setQuery(r.display_name);
    setOpen(false);
    setResults([]);
    onChange(fromNominatim(r));
  };

  const useMyLocation = () => {
    setLocating(true);
    setError('');
    geolocate(
      async (lat, lng) => {
        try {
          const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'jsonv2', addressdetails: '1', 'accept-language': 'en' });
          const res = await fetch(`${NOMINATIM}/reverse?${params}`);
          const r = (await res.json()) as NominatimResult;
          onChange({ ...fromNominatim(r), lat, lng });
        } catch {
          // Keep the exact position even if we couldn't look up the address
          onChange({ address: '', city: '', state: '', pincode: '', lat, lng });
          setError('Got your location, but couldn’t look up the address. Fill it in below.');
        } finally {
          setLocating(false);
        }
      },
      (message) => {
        setLocating(false);
        setError(message);
      }
    );
  };

  const pinned = typeof value?.lat === 'number' && typeof value?.lng === 'number';

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </span>
          <input
            id="location-search"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length < 3) {
                setResults([]);
                setOpen(false);
              }
            }}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 160)}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            placeholder="Search the building, street or a landmark"
            className={searchInputClass}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery('');
                setResults([]);
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {open && (
            <div className={dropdownClass}>
              {results.length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-muted">No matches. Try a nearby landmark or the area name.</p>
              ) : (
                results.map((r) => (
                  <button
                    key={r.place_id}
                    type="button"
                    onMouseDown={() => pick(r)}
                    className="flex w-full items-start gap-2.5 px-4 py-3 text-left text-sm transition-colors hover:bg-surface"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    <span className="line-clamp-2">{r.display_name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <GpsButton onClick={useMyLocation} loading={locating} />
      </div>

      {error && <ErrorLine>{error}</ErrorLine>}

      {pinned ? (
        <div className="overflow-hidden rounded-[22px] border border-black/[0.06]">
          <iframe
            title="Pinned location"
            className="h-60 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps?q=${value!.lat},${value!.lng}&z=16&output=embed`}
          />
          <p className="px-4 py-2.5 text-[13px] text-muted">
            Pin looks off? Search a nearby landmark, or use your location while you’re at the property.
          </p>
        </div>
      ) : (
        <p className="text-[13px] text-muted">Search above or use your location to drop a pin on the map.</p>
      )}
      <p className="text-[11px] text-muted">Address search by OpenStreetMap © OpenStreetMap contributors</p>
    </div>
  );
}

/* ─── With a Google Maps key ──────────────────────────────────────────── */

type GeocoderAddressComponent = google.maps.GeocoderAddressComponent;
type GeocoderResult = google.maps.GeocoderResult;

function extractComp(components: GeocoderAddressComponent[], type: string): string {
  return components.find((c) => c.types.includes(type))?.long_name ?? '';
}

function parseGeocodeResult(res: GeocoderResult): Omit<LocationResult, 'lat' | 'lng'> {
  const comps = res.address_components;
  const streetNum = extractComp(comps, 'street_number');
  const route = extractComp(comps, 'route');
  const sub1 = extractComp(comps, 'sublocality_level_1') || extractComp(comps, 'sublocality');
  const address = [streetNum, route, sub1].filter(Boolean).join(', ') || res.formatted_address.split(',')[0];
  const city =
    extractComp(comps, 'locality') ||
    extractComp(comps, 'administrative_area_level_3') ||
    extractComp(comps, 'administrative_area_level_2');
  const state = extractComp(comps, 'administrative_area_level_1');
  const pincode = extractComp(comps, 'postal_code');
  return { address, city, state, pincode };
}

// Marker overlay — must live inside <Map> to call useMap()
interface MarkerOverlayProps {
  markerPos: google.maps.LatLngLiteral | null;
  mapRef: React.MutableRefObject<google.maps.Map | null>;
  onDragEnd: (lat: number, lng: number) => void;
}

function MarkerOverlay({ markerPos, mapRef, onDragEnd }: MarkerOverlayProps) {
  const map = useMap('location-picker-map');
  // Store the map instance in the ref so the parent can call panTo/setZoom
  useEffect(() => {
    if (map) mapRef.current = map;
  }, [map, mapRef]);

  if (!markerPos) return null;
  return (
    <AdvancedMarker
      position={markerPos}
      draggable={true}
      onDragEnd={(e: google.maps.MapMouseEvent) => {
        if (e.latLng) onDragEnd(e.latLng.lat(), e.latLng.lng());
      }}
      title="Drag to fine-tune location"
    />
  );
}

function GoogleLocationPicker({ value, onChange, className }: LocationPickerProps) {
  const geocodingLib = useMapsLibrary('geocoding');
  const placesLib = useMapsLibrary('places');

  const mapRef = useRef<google.maps.Map | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geocoderRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autocompleteRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionTokenRef = useRef<any>(null);

  const [markerPos, setMarkerPos] = useState<google.maps.LatLngLiteral | null>(
    value?.lat && value?.lng ? { lat: value.lat, lng: value.lng } : null
  );
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingGPS, setIsLoadingGPS] = useState(false);
  const [isLoadingGeocode, setIsLoadingGeocode] = useState(false);
  const [error, setError] = useState('');

  // Initialise geocoder + places services
  useEffect(() => {
    if (geocodingLib) geocoderRef.current = new geocodingLib.Geocoder();
  }, [geocodingLib]);

  useEffect(() => {
    if (placesLib) {
      autocompleteRef.current = new placesLib.AutocompleteService();
      sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
    }
  }, [placesLib]);

  // Places autocomplete with debounce
  useEffect(() => {
    const val = searchInput.trim();
    if (!val || val.length < 3 || !autocompleteRef.current) return;
    const timer = setTimeout(() => {
      autocompleteRef.current.getPlacePredictions(
        { input: val, sessionToken: sessionTokenRef.current, componentRestrictions: { country: 'in' } },
        (preds: google.maps.places.AutocompletePrediction[] | null, status: string) => {
          if (status === 'OK' && preds) {
            setSuggestions(preds);
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
          }
        }
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const geocodeAndApply = useCallback(
    async (request: google.maps.GeocoderRequest) => {
      if (!geocoderRef.current) return;
      setIsLoadingGeocode(true);
      setError('');
      try {
        const result = await geocoderRef.current.geocode(request);
        if (!result.results?.length) {
          setError('Couldn’t find that location. Try a different address or a Plus Code.');
          return;
        }
        const res: GeocoderResult = result.results[0];
        const lat = res.geometry.location.lat();
        const lng = res.geometry.location.lng();
        setMarkerPos({ lat, lng });
        if (mapRef.current) {
          mapRef.current.panTo({ lat, lng });
          mapRef.current.setZoom(17);
        }
        onChange({ ...parseGeocodeResult(res), lat, lng });
        // Rotate session token for billing efficiency
        if (placesLib) sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
      } catch {
        setError('Couldn’t look up that location. Please try again.');
      } finally {
        setIsLoadingGeocode(false);
      }
    },
    [onChange, placesLib]
  );

  const selectSuggestion = (pred: google.maps.places.AutocompletePrediction) => {
    setSearchInput(pred.description);
    setSuggestions([]);
    setShowSuggestions(false);
    geocodeAndApply({ placeId: pred.place_id, region: 'IN' });
  };

  const handleUseMyLocation = () => {
    setIsLoadingGPS(true);
    setError('');
    geolocate(
      async (lat, lng) => {
        await geocodeAndApply({ location: { lat, lng } });
        setIsLoadingGPS(false);
      },
      (message) => {
        setIsLoadingGPS(false);
        setError(message);
      }
    );
  };

  const handleMapClick = useCallback(
    async (e: MapMouseEvent) => {
      if (!e.detail.latLng) return;
      const { lat, lng } = e.detail.latLng;
      setMarkerPos({ lat, lng });
      await geocodeAndApply({ location: { lat, lng } });
    },
    [geocodeAndApply]
  );

  const handleMarkerDragEnd = useCallback(
    async (lat: number, lng: number) => {
      setMarkerPos({ lat, lng });
      await geocodeAndApply({ location: { lat, lng } });
    },
    [geocodeAndApply]
  );

  if (!geocodingLib || !placesLib) {
    return (
      <div className={cn('flex h-[340px] items-center justify-center rounded-[22px] bg-surface', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
            {isLoadingGeocode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </span>
          <input
            id="location-search"
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              if (e.target.value.trim().length < 3) setSuggestions([]);
            }}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 160)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchInput.trim()) {
                e.preventDefault();
                setSuggestions([]);
                setShowSuggestions(false);
                geocodeAndApply({ address: searchInput.trim(), region: 'IN' });
              }
              if (e.key === 'Escape') {
                setSuggestions([]);
                setShowSuggestions(false);
              }
            }}
            placeholder="Search address, landmark, or Plus Code (e.g. P473+7HW Jorhat)"
            className={searchInputClass}
          />
          {searchInput && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setSearchInput('');
                setSuggestions([]);
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div className={dropdownClass}>
              {suggestions.map((pred) => (
                <button
                  key={pred.place_id}
                  type="button"
                  onMouseDown={() => selectSuggestion(pred)}
                  className="flex w-full items-start gap-2.5 px-4 py-3 text-left text-sm transition-colors hover:bg-surface"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  <span>
                    <span className="block font-medium leading-tight">{pred.structured_formatting.main_text}</span>
                    <span className="mt-0.5 block text-xs text-muted">{pred.structured_formatting.secondary_text}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <GpsButton onClick={handleUseMyLocation} loading={isLoadingGPS} />
      </div>

      {error && <ErrorLine>{error}</ErrorLine>}
      <p className="text-[13px] text-muted">
        {markerPos ? 'Pinned — drag the marker to fine-tune it.' : 'Search above, use your location, or click the map to drop a pin.'}
      </p>

      <div className="h-[300px] overflow-hidden rounded-[22px] border border-black/[0.06]">
        <Map
          id="location-picker-map"
          defaultCenter={markerPos ?? { lat: 20.5937, lng: 78.9629 }}
          defaultZoom={markerPos ? 17 : 5}
          mapId="location-picker-map"
          gestureHandling="greedy"
          style={{ width: '100%', height: '100%' }}
          onClick={handleMapClick}
        >
          <MarkerOverlay markerPos={markerPos} mapRef={mapRef} onDragEnd={handleMarkerDragEnd} />
        </Map>
      </div>
    </div>
  );
}
