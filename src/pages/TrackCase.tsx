import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Search, MapPin, Clock, CheckCircle, Loader, AlertCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useToast } from '../components/Toast';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pending', color: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-800', icon: Clock },
  in_progress: { label: 'In Progress', color: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-800', icon: Loader },
  resolved: { label: 'Resolved', color: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-800', icon: CheckCircle },
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
        <Link to="/" className="p-2 -ml-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold text-xl text-gray-900 dark:text-white">Track Your Case</h1>
      </div>

      <form onSubmit={handleTrack} className="flex gap-2">
        <input 
          type="text" 
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Enter tracking code..."
          className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-mono"
        />
        <button type="submit" disabled={loading} className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2">
          <Search className="w-4 h-4" />
        </button>
      </form>

      {loading && (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">Looking up case...</div>
      )}

      {notFound && (
        <div className="text-center py-8 flex flex-col items-center gap-3">
          <AlertCircle className="w-10 h-10 text-gray-300 dark:text-gray-600" />
          <div>
            <p className="text-gray-600 dark:text-gray-300 font-medium">Case not found</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Double-check your tracking code and try again.</p>
          </div>
        </div>
      )}

      {caseData && statusInfo && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded-md w-fit">
                  {caseData.species}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Reported {new Date(caseData.created_at).toLocaleString()}
                </span>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${statusInfo.color}`}>
                <statusInfo.icon className="w-3.5 h-3.5" />
                {statusInfo.label}
              </div>
            </div>

            {caseData.description && (
              <p className="text-sm text-gray-700 dark:text-gray-300">{caseData.description}</p>
            )}

            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {caseData.lat.toFixed(4)}, {caseData.lng.toFixed(4)}
            </div>
          </div>

          {caseData.updates && caseData.updates.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Timeline</h3>
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
                        {!isLast && <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700 my-1" />}
                      </div>
                      <div className={`pb-4 flex flex-col gap-0.5 ${isLast ? '' : ''}`}>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">{update.status.replace('_', ' ')}</span>
                        {update.note && <span className="text-xs text-gray-500 dark:text-gray-400">{update.note}</span>}
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">{new Date(update.created_at).toLocaleString()}</span>
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
          <p className="text-gray-400 dark:text-gray-500 text-sm">Enter the tracking code you received when reporting a case.</p>
        </div>
      )}
    </motion.div>
  );
}
