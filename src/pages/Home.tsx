import { useState, useEffect } from 'react';
import { Phone, Search, Navigation, MapPin, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

const ANIMAL_TYPES = [
  { id: 'dog', label: 'Dogs' },
  { id: 'cat', label: 'Cats' },
  { id: 'bird', label: 'Birds' },
  { id: 'wildlife', label: 'Wildlife' },
];

export default function Home() {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locating, setLocating] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [searchRadius, setSearchRadius] = useState(50);
  const [ngos, setNgos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNgos = async (overrides?: { q?: string; species?: string | null; loc?: {lat: number, lng: number} | null; radius?: number }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const q = overrides?.q ?? query;
      const species = overrides?.species !== undefined ? overrides.species : selectedType;
      const loc = overrides?.loc !== undefined ? overrides.loc : location;
      const radius = overrides?.radius ?? searchRadius;

      if (q.trim()) params.append('q', q.trim());
      if (species) params.append('species', species);
      if (loc) {
        params.append('lat', loc.lat.toString());
        params.append('lng', loc.lng.toString());
        params.append('radius', radius.toString());
      }

      const res = await fetch(`/api/ngos${params.toString() ? '?' + params : ''}`);
      const data = await res.json();
      setNgos(Array.isArray(data) ? data : []);
    } catch {
      toast('Failed to load NGOs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => fetchNgos(), query ? 300 : 0);
    return () => clearTimeout(t);
  }, [query, selectedType, searchRadius]);

  useEffect(() => {
    if (location) fetchNgos({ loc: location });
  }, [location]);

  const getLocation = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast('Location detected', 'success');
      },
      () => {
        setLocating(false);
        toast('Could not get location', 'error');
      }
    );
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      <section className="pt-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
          Find animal rescue help nearby
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm sm:text-base">
          {ngos.length > 0 ? `${ngos.length} verified` : 'Verified'} rescue organizations across Mumbai
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, city, or area..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 dark:focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={getLocation}
            disabled={locating}
            className={`flex items-center gap-1.5 text-xs font-medium border px-3 py-2 rounded-lg transition-all disabled:opacity-50 ${
              location
                ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            {locating ? 'Locating...' : location ? 'Near me' : 'Use location'}
          </button>
          {location && (
            <div className="flex items-center gap-2 flex-1 min-w-[140px]">
              <input
                type="range" min="5" max="100" value={searchRadius}
                onChange={e => setSearchRadius(Number(e.target.value))}
                className="flex-1 h-1"
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium w-12 text-right">{searchRadius} km</span>
            </div>
          )}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {ANIMAL_TYPES.map(type => {
            const active = selectedType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setSelectedType(active ? null : type.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {type.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {loading ? 'Searching...' : `${ngos.length} result${ngos.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3 mb-2" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-1/2 mb-3" />
                <div className="flex gap-1.5 mb-3">
                  <div className="h-5 w-12 bg-slate-100 dark:bg-slate-800/60 rounded" />
                  <div className="h-5 w-10 bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
                <div className="h-9 bg-slate-100 dark:bg-slate-800/60 rounded-lg" />
              </div>
            ))}
          </div>
        ) : ngos.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
              <Search className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
            <div>
              <p className="text-slate-600 dark:text-slate-300 font-medium text-sm">No organizations found</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Try a different search or broaden the radius</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ngos.map((ngo) => (
              <div
                key={ngo.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm leading-snug">{ngo.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{ngo.address}</span>
                    </p>
                  </div>
                  {ngo.distance !== undefined && (
                    <span className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded shrink-0">
                      {ngo.distance.toFixed(1)} km
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {ngo.species?.map((s: string) => (
                    <span key={s} className="text-[10px] uppercase tracking-wider font-medium bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 px-1.5 py-0.5 rounded">
                      {s}
                    </span>
                  ))}
                </div>

                <a
                  href={`tel:${ngo.phone}`}
                  className="flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {ngo.phone}
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
        <Link
          to="/report"
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-medium py-3 px-6 rounded-lg shadow-lg shadow-teal-600/20 dark:shadow-teal-600/10 transition-all hover:shadow-xl"
        >
          <Plus className="w-4 h-4" />
          Report a rescue
        </Link>
      </div>
    </div>
  );
}
