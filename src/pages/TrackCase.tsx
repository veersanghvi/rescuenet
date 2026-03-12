import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Search, MapPin, Clock, CheckCircle, Loader, AlertCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useToast } from '../components/Toast';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pending', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: Clock },
  in_progress: { label: 'In Progress', color: 'text-blue-700 bg-blue-50 border-blue-200', icon: Loader },
  resolved: { label: 'Resolved', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: CheckCircle },
};

export default function TrackCase() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const handleTrack = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!token.trim()) {
      toast('Please enter a tracking code', 'error');
      return;
    }

    setLoading(true);
    setNotFound(false);
    setCaseData(null);

    try {
      const res = await fetch(`/api/cases/track/${encodeURIComponent(token.trim())}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCaseData(data);
    } catch {
      toast('Failed to look up case. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Auto-search if token is in URL
  useEffect(() => {
    if (token) handleTrack();
  }, []);

  const statusInfo = caseData ? STATUS_CONFIG[caseData.status] || STATUS_CONFIG.pending : null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-6"
    >
      <div className="flex items-center gap-3">
        <Link to="/" className="p-2 -ml-2 text-stone-500 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold text-xl text-stone-900">Track Your Case</h1>
      </div>

      <form onSubmit={handleTrack} className="flex gap-2">
        <input 
          type="text" 
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Enter tracking code..."
          className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-mono"
        />
        <button type="submit" disabled={loading} className="bg-stone-900 text-white px-5 rounded-xl font-medium hover:bg-stone-800 transition-colors disabled:opacity-50 flex items-center gap-2">
          <Search className="w-4 h-4" />
        </button>
      </form>

      {loading && (
        <div className="text-center py-8 text-stone-400 text-sm">Looking up case...</div>
      )}

      {notFound && (
        <div className="text-center py-8 flex flex-col items-center gap-3">
          <AlertCircle className="w-10 h-10 text-stone-300" />
          <div>
            <p className="text-stone-600 font-medium">Case not found</p>
            <p className="text-stone-400 text-sm mt-1">Double-check your tracking code and try again.</p>
          </div>
        </div>
      )}

      {caseData && statusInfo && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          <div className="bg-white border border-stone-200 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-1 rounded-md w-fit">
                  {caseData.species}
                </span>
                <span className="text-xs text-stone-400 mt-1">
                  Reported {new Date(caseData.created_at).toLocaleString()}
                </span>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${statusInfo.color}`}>
                <statusInfo.icon className="w-3.5 h-3.5" />
                {statusInfo.label}
              </div>
            </div>

            {caseData.description && (
              <p className="text-sm text-stone-700">{caseData.description}</p>
            )}

            <div className="text-xs text-stone-500 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {caseData.lat.toFixed(4)}, {caseData.lng.toFixed(4)}
            </div>
          </div>

          {caseData.updates && caseData.updates.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="font-semibold text-stone-800 text-sm">Timeline</h3>
              <div className="relative flex flex-col gap-0">
                {caseData.updates.map((update: any, i: number) => {
                  const isLast = i === caseData.updates.length - 1;
                  const config = STATUS_CONFIG[update.status] || STATUS_CONFIG.pending;
                  const Icon = config.icon;
                  return (
                    <div key={i} className="flex gap-3 relative">
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center border ${config.color} shrink-0`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        {!isLast && <div className="w-px flex-1 bg-stone-200 my-1" />}
                      </div>
                      <div className={`pb-4 flex flex-col gap-0.5 ${isLast ? '' : ''}`}>
                        <span className="text-sm font-medium text-stone-800 capitalize">{update.status.replace('_', ' ')}</span>
                        {update.note && <span className="text-xs text-stone-500">{update.note}</span>}
                        <span className="text-[10px] text-stone-400">{new Date(update.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {!caseData && !notFound && !loading && (
        <div className="text-center py-6 flex flex-col items-center gap-2">
          <p className="text-stone-400 text-sm">Enter the tracking code you received when reporting a case.</p>
        </div>
      )}
    </motion.div>
  );
}
