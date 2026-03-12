import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Phone, Dog, Cat, Bird, Bug, Search, Navigation, AlertCircle, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

const ANIMAL_TYPES = [
  { id: 'dog', label: 'Dog', icon: Dog },
  { id: 'cat', label: 'Cat', icon: Cat },
  { id: 'bird', label: 'Bird', icon: Bird },
  { id: 'wildlife', label: 'Wildlife', icon: Bug },
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

  // Debounced search on query change
  useEffect(() => {
    const t = setTimeout(() => fetchNgos(), query ? 300 : 0);
    return () => clearTimeout(t);
  }, [query, selectedType, searchRadius]);

  // Re-fetch when location changes (not debounced)
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5 pb-24">
      {/* Hero */}
      <section className="pt-2">
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white leading-tight tracking-tight">
          Find rescue help<br />for animals nearby
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Search {ngos.length > 0 ? `${ngos.length}+` : ''} verified rescue organizations across India
        </p>
      </section>

      {/* Search + Filters */}
      <section className="flex flex-col gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, city, or area..."
            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 dark:focus:border-red-500 shadow-sm dark:shadow-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={getLocation}
            disabled={locating}
            className={`flex items-center gap-1.5 text-xs font-medium border px-3 py-2 rounded-xl transition-all disabled:opacity-50 ${
              location
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
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
                className="flex-1 accent-red-600 h-1"
              />
              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium w-12 text-right">{searchRadius} km</span>
            </div>
          )}
        </div>

        {/* Animal type chips */}
        <div className="flex gap-2">
          {ANIMAL_TYPES.map(type => {
            const Icon = type.icon;
            const active = selectedType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setSelectedType(active ? null : type.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                  active
                    ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white text-white dark:text-gray-900 shadow-sm'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {type.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Results */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {loading ? 'Searching...' : `${ngos.length} organization${ngos.length !== 1 ? 's' : ''} found`}
        </h3>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 dark:bg-gray-800/60 rounded w-1/2 mb-3" />
                <div className="flex gap-1.5 mb-3">
                  <div className="h-5 w-12 bg-gray-100 dark:bg-gray-800/60 rounded-full" />
                  <div className="h-5 w-10 bg-gray-100 dark:bg-gray-800/60 rounded-full" />
                </div>
                <div className="h-10 bg-gray-100 dark:bg-gray-800/60 rounded-xl" />
              </div>
            ))}
          </div>
        ) : ngos.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <Search className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-300 font-medium text-sm">No organizations found</p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Try a different search or broaden the radius</p>
            </div>
          </div>
        ) : (
          ngos.map((ngo, i) => (
            <motion.div
              key={ngo.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex flex-col gap-3 shadow-sm dark:shadow-none hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-[15px] leading-snug">{ngo.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{ngo.address}</span>
                  </p>
                </div>
                {ngo.distance !== undefined && (
                  <span className="text-[11px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-lg shrink-0">
                    {ngo.distance.toFixed(1)} km
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {ngo.species?.map((s: string) => (
                  <span key={s} className="text-[10px] uppercase tracking-wider font-semibold bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
                    {s}
                  </span>
                ))}
              </div>

              <a
                href={`tel:${ngo.phone}`}
                className="flex items-center justify-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <Phone className="w-4 h-4" />
                {ngo.phone}
              </a>
            </motion.div>
          ))
        )}
      </section>

      {/* Floating Emergency Button */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
        <Link
          to="/report"
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-3.5 px-8 rounded-2xl shadow-lg shadow-red-600/25 dark:shadow-red-600/15 transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
        >
          <AlertCircle className="w-5 h-5" />
          Report Emergency
        </Link>
      </div>
    </motion.div>
  );
}
