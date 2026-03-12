import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { MapPin, Phone, AlertCircle, Dog, Cat, Bird, Bug, ArrowRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import { useToast } from '../components/Toast';

const ANIMAL_TYPES = [
  { id: 'dog', label: 'Dog', icon: Dog },
  { id: 'cat', label: 'Cat', icon: Cat },
  { id: 'bird', label: 'Bird', icon: Bird },
  { id: 'wildlife', label: 'Wildlife', icon: Bug },
];

export default function Home() {
  const { toast } = useToast();
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locating, setLocating] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [searchRadius, setSearchRadius] = useState<number>(20);
  const [ngos, setNgos] = useState<any[]>([]);
  const [loadingNgos, setLoadingNgos] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{text: string, chunks: any[]} | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const performSearch = useCallback(async (query: string, loc?: {lat: number, lng: number} | null) => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const body: any = { query };
      const effectiveLoc = loc !== undefined ? loc : location;
      if (effectiveLoc) {
        body.lat = effectiveLoc.lat;
        body.lng = effectiveLoc.lng;
      }
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults({ text: data.text, chunks: data.chunks || [] });
    } catch {
      setSearchResults({ text: 'Sorry, search is unavailable right now. Please try again later.', chunks: [] });
    } finally {
      setIsSearching(false);
    }
  }, [location]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedType(null);
    performSearch(searchQuery);
  };

  const fetchNgos = useCallback(async (loc?: {lat: number, lng: number} | null, species?: string | null, radius?: number) => {
    setLoadingNgos(true);
    try {
      let url = '/api/ngos';
      const params = new URLSearchParams();
      const effectiveLoc = loc !== undefined ? loc : location;
      const effectiveSpecies = species !== undefined ? species : selectedType;
      const effectiveRadius = radius !== undefined ? radius : searchRadius;

      if (effectiveLoc) {
        params.append('lat', effectiveLoc.lat.toString());
        params.append('lng', effectiveLoc.lng.toString());
        params.append('radius', effectiveRadius.toString());
      }
      if (effectiveSpecies) {
        params.append('species', effectiveSpecies);
      }
      if (params.toString()) {
        url += '?' + params.toString();
      }
      
      const res = await fetch(url);
      const data = await res.json();
      setNgos(Array.isArray(data) ? data : []);
    } catch {
      toast('Failed to load NGOs', 'error');
    } finally {
      setLoadingNgos(false);
    }
  }, [location, selectedType, searchRadius, toast]);

  const getLocation = () => {
    setLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setLocation(loc);
          setLocating(false);
          fetchNgos(loc);
          toast('Location detected', 'success');
        },
        () => {
          setLocating(false);
          toast('Could not get location. Showing all NGOs.', 'error');
          fetchNgos(null);
        }
      );
    } else {
      setLocating(false);
      fetchNgos(null);
    }
  };

  useEffect(() => {
    fetchNgos();
  }, [selectedType, searchRadius]);

  useEffect(() => {
    if (selectedType) {
      const animalLabel = ANIMAL_TYPES.find(t => t.id === selectedType)?.label || selectedType;
      const query = `animal rescue for ${animalLabel}`;
      setSearchQuery(query);
      performSearch(query);
    }
  }, [selectedType]);

  const filteredNgos = Array.isArray(ngos) ? ngos : [];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      <section className="bg-red-50 border border-red-100 rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-red-700 font-semibold">
          <AlertCircle className="w-5 h-5" />
          <h2>Emergency Rescue</h2>
        </div>
        <p className="text-sm text-red-600/80">
          Find the nearest animal rescue NGO or report an injured animal immediately.
        </p>
        <Link 
          to="/report" 
          className="mt-2 bg-red-600 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-red-700 transition-colors"
        >
          Report Injured Animal
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      <section className="flex flex-col gap-3">
        <form onSubmit={handleSearch} className="relative">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search NGOs by name or location..."
            className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-24 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
          />
          <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <button type="submit" disabled={isSearching} className="absolute right-2 top-1/2 -translate-y-1/2 bg-stone-900 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-stone-800 disabled:opacity-50 transition-colors">
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {searchResults && (
          <div className="bg-white border border-stone-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-stone-800">Search Results</h3>
              <button onClick={() => setSearchResults(null)} className="text-xs font-medium text-stone-500 hover:text-stone-800">Clear</button>
            </div>
            <div className="text-sm text-stone-700 prose prose-sm max-w-none leading-relaxed">
              <Markdown>{searchResults.text}</Markdown>
            </div>
            {searchResults.chunks && searchResults.chunks.length > 0 && (
              <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-stone-100">
                <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Map Listings</h4>
                <div className="flex flex-col gap-2">
                  {searchResults.chunks.map((chunk: any, i: number) => {
                    if (chunk.maps) {
                      return (
                        <a key={i} href={chunk.maps.uri} target="_blank" rel="noopener noreferrer" className="flex flex-col p-2 rounded-lg border border-stone-100 hover:bg-stone-50 transition-colors">
                          <span className="font-medium text-stone-900 text-sm">{chunk.maps.title}</span>
                          <span className="text-xs text-blue-600 truncate">{chunk.maps.uri}</span>
                        </a>
                      );
                    } else if (chunk.web) {
                       return (
                        <a key={i} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="flex flex-col p-2 rounded-lg border border-stone-100 hover:bg-stone-50 transition-colors">
                          <span className="font-medium text-stone-900 text-sm">{chunk.web.title}</span>
                          <span className="text-xs text-blue-600 truncate">{chunk.web.uri}</span>
                        </a>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-stone-800">Animal Type</h3>
          {selectedType && (
            <button 
              onClick={() => {
                setSelectedType(null);
                setSearchQuery('');
                setSearchResults(null);
              }}
              className="text-xs text-stone-500 hover:text-stone-800 font-medium"
            >
              Clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-4 gap-3">
          {ANIMAL_TYPES.map(type => {
            const Icon = type.icon;
            const isSelected = selectedType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                  isSelected 
                    ? 'bg-stone-900 border-stone-900 text-white shadow-md' 
                    : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{type.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-stone-800">Nearest NGOs</h3>
            <button 
              onClick={getLocation}
              disabled={locating}
              className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors"
            >
              <MapPin className="w-3 h-3" />
              {locating ? 'Locating...' : location ? 'Location Active' : 'Use Location'}
            </button>
          </div>
          {location && (
            <div className="flex items-center gap-3 bg-stone-50 p-3 rounded-xl border border-stone-100">
              <label className="text-xs font-medium text-stone-600 whitespace-nowrap">
                Radius: {searchRadius} km
              </label>
              <input 
                type="range" 
                min="1" 
                max="100" 
                value={searchRadius} 
                onChange={(e) => setSearchRadius(Number(e.target.value))}
                className="w-full accent-red-600"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {loadingNgos ? (
            <div className="text-center py-8 text-stone-400 text-sm">Loading NGOs...</div>
          ) : filteredNgos.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-sm bg-white rounded-2xl border border-stone-100">
              No NGOs found for this animal type.
            </div>
          ) : (
            filteredNgos.map((ngo, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={ngo.id} 
                className="bg-white border border-stone-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-stone-900">{ngo.name}</h4>
                    <p className="text-sm text-stone-500 mt-0.5">{ngo.address}</p>
                  </div>
                  {ngo.distance !== undefined && (
                    <span className="text-xs font-medium bg-stone-100 text-stone-600 px-2 py-1 rounded-md">
                      {ngo.distance.toFixed(1)} km
                    </span>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-1.5">
                  {ngo.species.map((t: string) => (
                    <span key={t} className="text-[10px] uppercase tracking-wider font-semibold bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>

                <a 
                  href={`tel:${ngo.phone}`}
                  className="mt-1 w-full flex items-center justify-center gap-2 bg-stone-900 text-white py-2.5 rounded-xl font-medium hover:bg-stone-800 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  Call {ngo.phone}
                </a>
              </motion.div>
            ))
          )}
        </div>
      </section>
    </motion.div>
  );
}
