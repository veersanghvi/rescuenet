import React, { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, AlertTriangle, Copy, CheckCircle, ImagePlus } from 'lucide-react';
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
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!location) {
      toast('Please set the rescue location on the map or use GPS.', 'error');
      return;
    }

    setSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    formData.set('lat', String(location.lat));
    formData.set('lng', String(location.lng));

    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to submit case');
      }
      const result = await res.json();
      setSubmittedToken(result.token);
      toast('Rescue case submitted successfully!', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to submit case. Please try again.', 'error');
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
      <div className="flex flex-col items-center gap-6 py-8 max-w-md mx-auto">
        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-500/10 rounded-lg flex items-center justify-center">
          <CheckCircle className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="text-center flex flex-col gap-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Case Submitted</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Your rescue request has been received. Save your tracking code to check the status later.</p>
        </div>
        <div className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tracking Code</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">{submittedToken}</span>
          </div>
          <button onClick={copyToken} className="shrink-0 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            {copied ? <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
          </button>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <Link to={`/track?token=${submittedToken}`} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium py-2.5 rounded-lg text-center text-sm hover:opacity-90 transition-opacity">
            Track My Case
          </Link>
          <Link to="/until-help" className="w-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-medium py-2.5 rounded-lg text-center text-sm hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors">
            Read what to do until help arrives
          </Link>
          <Link to="/" className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium py-2.5 rounded-lg text-center text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-3">
        <Link to="/" className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold text-xl text-slate-900 dark:text-white">Report a rescue</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Animal type</label>
          <select 
            name="species" 
            required
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
          >
            <option value="">Select type...</option>
            <option value="dog">Dog</option>
            <option value="cat">Cat</option>
            <option value="bird">Bird</option>
            <option value="wildlife">Wildlife</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Location <span className="text-rose-500">*</span></label>
          <div className="flex gap-2 mb-1">
            <div className={`flex-1 border rounded-lg px-3.5 py-2.5 text-sm flex items-center ${location ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100' : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-800 text-rose-400'}`}>
              {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Tap map or use GPS'}
            </div>
            <button 
              type="button"
              onClick={getLocation}
              className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 rounded-lg flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              <MapPin className="w-4 h-4" />
            </button>
          </div>
          
          <div className="h-48 w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 relative z-0">
            <MapContainer 
              center={location ? [location.lat, location.lng] : [19.076, 72.8777]} 
              zoom={13} 
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {location && <MapUpdater center={[location.lat, location.lng]} />}
              <LocationMarker location={location} setLocation={setLocation} />
            </MapContainer>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Click on the map to manually set the rescue location.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description &amp; condition</label>
          <textarea 
            name="description" 
            required
            rows={4}
            placeholder="Describe the animal's condition, exact location details, etc."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all resize-none"
          ></textarea>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <ImagePlus className="w-4 h-4" />
            Upload photo (optional, max 500KB)
          </label>
          <input
            type="file"
            name="photo"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) {
                setPhotoPreview(null);
                return;
              }
              if (file.size > 500 * 1024) {
                toast('Image must be 500KB or smaller', 'error');
                e.currentTarget.value = '';
                setPhotoPreview(null);
                return;
              }
              setPhotoPreview(URL.createObjectURL(file));
            }}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 file:mr-3 file:rounded file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:px-2.5 file:py-1.5 file:text-xs file:font-medium"
          />
          {photoPreview && <img src={photoPreview} alt="Rescue preview" className="w-full h-44 object-cover rounded-lg border border-slate-200 dark:border-slate-800" />}
        </div>

        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-800 rounded-lg p-3.5 flex gap-3 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">
            Do not approach wild or aggressive animals. Keep a safe distance and wait for professional rescuers.
          </p>
        </div>

        <button 
          type="submit"
          disabled={submitting}
          className="w-full bg-teal-600 text-white font-medium py-2.5 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed text-sm"
        >
          {submitting ? 'Submitting...' : 'Submit rescue request'}
        </button>
      </form>
    </div>
  );
}
