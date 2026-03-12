import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Plus, Trash2, MapPin, X, FileText, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { useAuth, authHeaders } from '../components/Auth';

const SPECIES_OPTIONS = ['dog', 'cat', 'bird', 'wildlife'];

export default function Volunteer() {
  const { toast } = useToast();
  const { user, token } = useAuth();
  const [ngos, setNgos] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [tab, setTab] = useState<'ngos' | 'cases'>('ngos');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingNgo, setAddingNgo] = useState(false);

  const fetchNgos = async () => {
    try {
      const res = await fetch('/api/ngos?all=1');
      setNgos(await res.json());
    } catch { toast('Failed to load NGOs', 'error'); }
  };

  const fetchCases = async () => {
    try {
      const res = await fetch('/api/cases', { headers: authHeaders(token) });
      if (!res.ok) throw new Error();
      setCases(await res.json());
    } catch { toast('Failed to load cases', 'error'); }
  };

  useEffect(() => { fetchNgos(); fetchCases(); }, []);

  const handleDeleteNgo = async (id: number) => {
    if (!confirm('Delete this NGO?')) return;
    try {
      const res = await fetch(`/api/ngos/${id}`, { method: 'DELETE', headers: authHeaders(token) });
      if (!res.ok) throw new Error();
      toast('NGO deleted', 'success');
      fetchNgos();
    } catch { toast('Failed to delete', 'error'); }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/cases/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast('Status updated', 'success');
      fetchCases();
    } catch { toast('Failed to update', 'error'); }
  };

  const handleAddNgo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAddingNgo(true);
    const fd = new FormData(e.currentTarget);
    const speciesChecked = SPECIES_OPTIONS.filter(s => fd.get(`species_${s}`));

    try {
      const res = await fetch('/api/ngos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          name: fd.get('name'),
          phone: fd.get('phone'),
          address: fd.get('address'),
          lat: parseFloat(fd.get('lat') as string),
          lng: parseFloat(fd.get('lng') as string),
          coverage_radius: parseFloat(fd.get('radius') as string) || 20,
          species: speciesChecked,
        }),
      });
      if (!res.ok) throw new Error();
      toast('NGO added', 'success');
      setShowAddForm(false);
      fetchNgos();
    } catch { toast('Failed to add NGO', 'error'); }
    finally { setAddingNgo(false); }
  };

  const statusStyle: Record<string, string> = {
    pending: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    in_progress: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    resolved: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  };

  const inputCls = "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link to="/" className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-lg text-slate-900 dark:text-white">Volunteer</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{user?.username}</p>
        </div>
      </div>

      <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg">
        <button onClick={() => setTab('ngos')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all ${tab === 'ngos' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
          <Building2 className="w-3.5 h-3.5" /> NGOs ({ngos.length})
        </button>
        <button onClick={() => setTab('cases')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all ${tab === 'cases' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
          <FileText className="w-3.5 h-3.5" /> Cases ({cases.length})
        </button>
      </div>

      {tab === 'ngos' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {ngos.map(ngo => (
            <div key={ngo.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex justify-between items-start gap-3">
              <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                <h4 className="font-medium text-slate-900 dark:text-white text-sm leading-snug">{ngo.name}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" />{ngo.address}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{ngo.phone}</p>
                {ngo.species && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(Array.isArray(ngo.species) ? ngo.species : ngo.species_list?.split(',') || []).map((s: string) => (
                      <span key={s} className="text-[10px] uppercase tracking-wider font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">{s}</span>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => handleDeleteNgo(ngo.id)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <AnimatePresence>
            {showAddForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleAddNgo}
                className="sm:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col gap-3 overflow-hidden"
              >
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-slate-900 dark:text-white text-sm">Add NGO</h4>
                  <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input name="name" required placeholder="NGO Name" className={inputCls} />
                  <input name="phone" required placeholder="Phone Number" className={inputCls} />
                </div>
                <input name="address" required placeholder="Full Address" className={inputCls} />
                <div className="grid grid-cols-3 gap-2">
                  <input name="lat" required type="number" step="any" placeholder="Latitude" className={inputCls} />
                  <input name="lng" required type="number" step="any" placeholder="Longitude" className={inputCls} />
                  <input name="radius" type="number" step="any" placeholder="Radius km" defaultValue="20" className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Species handled</label>
                  <div className="flex flex-wrap gap-3">
                    {SPECIES_OPTIONS.map(s => (
                      <label key={s} className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                        <input type="checkbox" name={`species_${s}`} value={s} className="accent-teal-600 rounded" />
                        <span className="capitalize">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={addingNgo} className="w-full bg-teal-600 text-white font-medium py-2.5 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 text-sm">
                  {addingNgo ? 'Adding...' : 'Add NGO'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {!showAddForm && (
            <button onClick={() => setShowAddForm(true)} className="sm:col-span-2 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-2.5 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-dashed border-slate-300 dark:border-slate-700 text-sm">
              <Plus className="w-4 h-4" /> Add NGO
            </button>
          )}
        </div>
      )}

      {tab === 'cases' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {cases.length === 0 ? (
            <div className="sm:col-span-2 text-center py-12 text-slate-400 dark:text-slate-500 text-sm">No cases yet</div>
          ) : cases.map(c => (
            <div key={c.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col gap-2.5">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 px-2 py-0.5 rounded">{c.species}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">#{c.id}</span>
                </div>
                <select
                  value={c.status}
                  onChange={e => updateStatus(c.id, e.target.value)}
                  className={`text-xs font-medium rounded-md px-2 py-1 border cursor-pointer outline-none ${statusStyle[c.status] || ''}`}
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              {c.description && <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">{c.description}</p>}
              <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.lat.toFixed(4)}, {c.lng.toFixed(4)}</span>
                <span>{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
