import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, MapPin, AlertTriangle, Copy, CheckCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useToast } from '../components/Toast';

const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function LocationMarker({ location, setLocation }: { location: {lat: number, lng: number} | null, setLocation: any }) {
  useMapEvents({
    click(e) {
      setLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return location === null ? null : (
    <Marker position={[location.lat, location.lng]} icon={customIcon}></Marker>
  )
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function Report() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [submittedToken, setSubmittedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!location) {
      toast('Please set the rescue location on the map or use GPS.', 'error');
      return;
    }

    setSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const data = {
      species: formData.get('species'),
      description: formData.get('description'),
      lat: location.lat,
      lng: location.lng,
    };

    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error();
      const result = await res.json();
      setSubmittedToken(result.token);
      toast('Rescue case submitted successfully!', 'success');
    } catch {
      toast('Failed to submit case. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToken = () => {
    if (submittedToken) {
      navigator.clipboard.writeText(submittedToken);
      setCopied(true);
      toast('Tracking code copied!', 'success');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          toast('Location detected', 'success');
        },
        () => {
          toast('Could not get location. Please tap the map to set it manually.', 'error');
        }
      );
    }
  };

  if (submittedToken) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6 py-8"
      >
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <div className="text-center flex flex-col gap-2">
          <h2 className="text-xl font-bold text-stone-900">Case Submitted!</h2>
          <p className="text-sm text-stone-500">Your rescue request has been received. Save your tracking code to check the status later.</p>
        </div>
        <div className="w-full bg-stone-50 border border-stone-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-stone-500 font-medium">Tracking Code</span>
            <span className="font-mono font-bold text-stone-900">{submittedToken}</span>
          </div>
          <button onClick={copyToken} className="shrink-0 p-2 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 transition-colors">
            {copied ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-stone-500" />}
          </button>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <Link to={`/track?token=${submittedToken}`} className="w-full bg-stone-900 text-white font-medium py-3 rounded-xl text-center hover:bg-stone-800 transition-colors">
            Track My Case
          </Link>
          <Link to="/" className="w-full bg-stone-100 text-stone-700 font-medium py-3 rounded-xl text-center hover:bg-stone-200 transition-colors">
            Back to Home
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col gap-6"
    >
      <div className="flex items-center gap-3">
        <Link to="/" className="p-2 -ml-2 text-stone-500 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold text-xl text-stone-900">Report Rescue</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-stone-700">Animal Type</label>
          <select 
            name="species" 
            required
            className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
          >
            <option value="">Select type...</option>
            <option value="dog">Dog</option>
            <option value="cat">Cat</option>
            <option value="bird">Bird</option>
            <option value="wildlife">Wildlife</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-stone-700">Location <span className="text-red-500">*</span></label>
          <div className="flex gap-2 mb-2">
            <div className={`flex-1 border rounded-xl px-4 py-3 text-sm flex items-center ${location ? 'bg-white border-stone-200 text-stone-900' : 'bg-red-50 border-red-200 text-red-400'}`}>
              {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Tap map or use GPS'}
            </div>
            <button 
              type="button"
              onClick={getLocation}
              className="bg-stone-900 text-white px-4 rounded-xl flex items-center justify-center hover:bg-stone-800 transition-colors"
            >
              <MapPin className="w-5 h-5" />
            </button>
          </div>
          
          <div className="h-48 w-full rounded-xl overflow-hidden border border-stone-200 relative z-0">
            <MapContainer 
              center={location ? [location.lat, location.lng] : [37.7749, -122.4194]} 
              zoom={13} 
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {location && <MapUpdater center={[location.lat, location.lng]} />}
              <LocationMarker location={location} setLocation={setLocation} />
            </MapContainer>
          </div>
          <p className="text-xs text-stone-500">Click on the map to manually set the rescue location.</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-stone-700">Description & Condition</label>
          <textarea 
            name="description" 
            required
            rows={4}
            placeholder="Describe the animal's condition, exact location details, etc."
            className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none"
          ></textarea>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3 text-amber-800">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-xs leading-relaxed">
            Do not approach wild or aggressive animals. Keep a safe distance and wait for professional rescuers.
          </p>
        </div>

        <button 
          type="submit"
          disabled={submitting}
          className="w-full bg-red-600 text-white font-semibold py-3.5 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed mt-2"
        >
          {submitting ? 'Submitting...' : 'Submit Rescue Request'}
        </button>
      </form>
    </motion.div>
  );
}
