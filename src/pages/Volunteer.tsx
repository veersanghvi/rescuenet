import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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

  const inputCls = "w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/" className="p-2 -ml-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-lg text-gray-900 dark:text-white">Volunteer Panel</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Signed in as <span className="font-medium text-gray-700 dark:text-gray-300">{user?.username}</span></p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl">
        <button onClick={() => setTab('ngos')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-lg transition-all ${tab === 'ngos' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
          <Building2 className="w-3.5 h-3.5" />NGOs ({ngos.length})
        </button>
        <button onClick={() => setTab('cases')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-lg transition-all ${tab === 'cases' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
          <FileText className="w-3.5 h-3.5" />Cases ({cases.length})
        </button>
      </div>

      {/* NGOs Tab */}
      {tab === 'ngos' && (
        <div className="flex flex-col gap-2.5">
          {ngos.map(ngo => (
            <div key={ngo.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex justify-between items-start gap-3">
              <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug">{ngo.name}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" />{ngo.address}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{ngo.phone}</p>
                {ngo.species && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(Array.isArray(ngo.species) ? ngo.species : ngo.species_list?.split(',') || []).map((s: string) => (
                      <span key={s} className="text-[10px] uppercase tracking-wider font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => handleDeleteNgo(ngo.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors shrink-0">
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
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-3 overflow-hidden"
              >
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Add New NGO</h4>
                  <button type="button" onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-4 h-4" /></button>
                </div>
                <input name="name" required placeholder="NGO Name" className={inputCls} />
                <input name="phone" required placeholder="Phone Number" className={inputCls} />
                <input name="address" required placeholder="Full Address" className={inputCls} />
                <div className="grid grid-cols-3 gap-2">
                  <input name="lat" required type="number" step="any" placeholder="Latitude" className={inputCls} />
                  <input name="lng" required type="number" step="any" placeholder="Longitude" className={inputCls} />
                  <input name="radius" type="number" step="any" placeholder="Radius km" defaultValue="20" className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Species handled</label>
                  <div className="flex flex-wrap gap-3">
                    {SPECIES_OPTIONS.map(s => (
                      <label key={s} className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                        <input type="checkbox" name={`species_${s}`} value={s} className="accent-red-600 rounded" />
                        <span className="capitalize">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={addingNgo} className="w-full bg-red-600 text-white font-medium py-2.5 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50">
                  {addingNgo ? 'Adding...' : 'Add NGO'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {!showAddForm && (
            <button onClick={() => setShowAddForm(true)} className="flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 py-3 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-dashed border-gray-300 dark:border-gray-700">
              <Plus className="w-4 h-4" /> Add New NGO
            </button>
          )}
        </div>
      )}

      {/* Cases Tab */}
      {tab === 'cases' && (
        <div className="flex flex-col gap-2.5">
          {cases.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">No cases yet</div>
          ) : cases.map(c => (
            <div key={c.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-2.5">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-md">{c.species}</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">#{c.id}</span>
                </div>
                <select
                  value={c.status}
                  onChange={e => updateStatus(c.id, e.target.value)}
                  className={`text-xs font-semibold rounded-lg px-2.5 py-1 border cursor-pointer outline-none ${statusStyle[c.status] || ''}`}
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              {c.description && <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{c.description}</p>}
              <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.lat.toFixed(4)}, {c.lng.toFixed(4)}</span>
                <span>{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
