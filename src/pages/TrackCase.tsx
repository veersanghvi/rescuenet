import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (token) handleTrack();
  }, []);

  const statusInfo = caseData ? STATUS_CONFIG[caseData.status] || STATUS_CONFIG.pending : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold text-lg text-slate-900 dark:text-white">Track case</h1>
      </div>

      <form onSubmit={handleTrack} className="flex gap-2">
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Enter tracking code..."
          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-mono"
        />
        <button type="submit" disabled={loading} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2">
          <Search className="w-4 h-4" />
        </button>
      </form>

      {loading && (
        <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">Looking up case...</div>
      )}

      {notFound && (
        <div className="text-center py-8 flex flex-col items-center gap-3">
          <AlertCircle className="w-10 h-10 text-slate-300 dark:text-slate-600" />
          <div>
            <p className="text-slate-600 dark:text-slate-300 font-medium text-sm">Case not found</p>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Double-check your tracking code and try again.</p>
          </div>
        </div>
      )}

      {caseData && statusInfo && (
        <div className="flex flex-col gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 px-2 py-0.5 rounded w-fit">
                  {caseData.species}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Reported {new Date(caseData.created_at).toLocaleString()}
                </span>
              </div>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium ${statusInfo.color}`}>
                <statusInfo.icon className="w-3.5 h-3.5" />
                {statusInfo.label}
              </div>
            </div>

            {caseData.description && (
              <p className="text-sm text-slate-700 dark:text-slate-300">{caseData.description}</p>
            )}

            {caseData.photo_url && (
              <img src={caseData.photo_url} alt="Reported animal" className="w-full h-44 object-cover rounded-lg border border-slate-200 dark:border-slate-700" loading="lazy" />
            )}

            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {caseData.lat.toFixed(4)}, {caseData.lng.toFixed(4)}
            </div>
          </div>

          {caseData.updates && caseData.updates.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="font-medium text-slate-800 dark:text-slate-200 text-sm">Timeline</h3>
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
                        {!isLast && <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 my-1" />}
                      </div>
                      <div className="pb-4 flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 capitalize">{update.status.replace('_', ' ')}</span>
                        {update.note && <span className="text-xs text-slate-500 dark:text-slate-400">{update.note}</span>}
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(update.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {!caseData && !notFound && !loading && (
        <div className="text-center py-6 flex flex-col items-center gap-2">
          <p className="text-slate-400 dark:text-slate-500 text-sm">Enter the tracking code you received when reporting a case.</p>
        </div>
      )}
    </div>
  );
}
