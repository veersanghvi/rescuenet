import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, MapPin, UserPlus, Trash2, Users, FileText, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { useAuth, authHeaders } from '../components/Auth';

export default function Admin() {
  const { toast } = useToast();
  const { user, token } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [tab, setTab] = useState<'cases' | 'users'>('cases');
  const [showUserForm, setShowUserForm] = useState(false);
  const [addingUser, setAddingUser] = useState(false);

  const fetchCases = async () => {
    try {
      const res = await fetch('/api/cases', { headers: authHeaders(token) });
      if (!res.ok) throw new Error();
      setCases(await res.json());
    } catch { toast('Failed to load cases', 'error'); }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/auth/users', { headers: authHeaders(token) });
      if (!res.ok) throw new Error();
      setUsers(await res.json());
    } catch { toast('Failed to load users', 'error'); }
  };

  useEffect(() => { fetchCases(); fetchUsers(); }, []);

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

  const handleAddUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAddingUser(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          username: fd.get('username'),
          password: fd.get('password'),
          role: fd.get('role'),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      toast('User created', 'success');
      setShowUserForm(false);
      fetchUsers();
    } catch (err: any) {
      toast(err.message || 'Failed to create user', 'error');
    } finally { setAddingUser(false); }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Delete this user?')) return;
    try {
      const res = await fetch(`/api/auth/users/${id}`, { method: 'DELETE', headers: authHeaders(token) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      toast('User deleted', 'success');
      fetchUsers();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const statusStyle: Record<string, string> = {
    pending: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    in_progress: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    resolved: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  };

  const pendingCount = cases.filter(c => c.status === 'pending').length;
  const activeCount = cases.filter(c => c.status === 'in_progress').length;

  const inputCls = "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-lg text-slate-900 dark:text-white">Admin</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{user?.username}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-900 rounded-lg px-3 py-2.5 text-center">
          <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{pendingCount}</div>
          <div className="text-[10px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-900 rounded-lg px-3 py-2.5 text-center">
          <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{activeCount}</div>
          <div className="text-[10px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">Active</div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2.5 text-center">
          <div className="text-lg font-bold text-slate-700 dark:text-slate-300">{users.length}</div>
          <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Staff</div>
        </div>
      </div>

      <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg">
        <button onClick={() => setTab('cases')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all ${tab === 'cases' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
          <FileText className="w-3.5 h-3.5" /> Cases
        </button>
        <button onClick={() => setTab('users')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all ${tab === 'users' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
          <Users className="w-3.5 h-3.5" /> Staff
        </button>
      </div>

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

      {tab === 'users' && (
        <div className="flex flex-col gap-2.5">
          {users.map(u => (
            <div key={u.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold ${u.role === 'admin' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400'}`}>
                  {u.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{u.username}</span>
                    <span className={`text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${u.role === 'admin' ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' : 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400'}`}>{u.role}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{new Date(u.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              {u.id !== user?.id && (
                <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          <AnimatePresence>
            {showUserForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleAddUser}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col gap-3 overflow-hidden"
              >
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-slate-900 dark:text-white text-sm">Create staff account</h4>
                  <button type="button" onClick={() => setShowUserForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input name="username" required placeholder="Username" className={inputCls} />
                <input name="password" required type="password" placeholder="Password" minLength={4} className={inputCls} />
                <select name="role" required className={inputCls}>
                  <option value="volunteer">Volunteer</option>
                  <option value="admin">Admin</option>
                </select>
                <button type="submit" disabled={addingUser} className="w-full bg-teal-600 text-white font-medium py-2.5 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 text-sm">
                  {addingUser ? 'Creating...' : 'Create account'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {!showUserForm && (
            <button onClick={() => setShowUserForm(true)} className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-2.5 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-dashed border-slate-300 dark:border-slate-700 text-sm">
              <UserPlus className="w-4 h-4" /> Add staff member
            </button>
          )}
        </div>
      )}
    </div>
  );
}
