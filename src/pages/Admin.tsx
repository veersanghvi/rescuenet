import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, MapPin, UserPlus, Trash2, Users, FileText, X, Shield, UserCheck } from 'lucide-react';
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-lg text-gray-900 dark:text-white">Admin Panel</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Signed in as <span className="font-medium text-gray-700 dark:text-gray-300">{user?.username}</span></p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-900 rounded-xl px-3 py-2.5 text-center">
          <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{pendingCount}</div>
          <div className="text-[10px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-900 rounded-xl px-3 py-2.5 text-center">
          <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{activeCount}</div>
          <div className="text-[10px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">Active</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2.5 text-center">
          <div className="text-lg font-bold text-gray-700 dark:text-gray-300">{users.length}</div>
          <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Staff</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl">
        <button onClick={() => setTab('cases')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-lg transition-all ${tab === 'cases' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
          <FileText className="w-3.5 h-3.5" />Cases
        </button>
        <button onClick={() => setTab('users')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-lg transition-all ${tab === 'users' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
          <Users className="w-3.5 h-3.5" />Staff
        </button>
      </div>

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

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="flex flex-col gap-2.5">
          {users.map(u => (
            <div key={u.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${u.role === 'admin' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                  {u.role === 'admin' ? <Shield className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{u.username}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${u.role === 'admin' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>{u.role}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">Joined {new Date(u.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              {u.id !== user?.id && (
                <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
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
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-3 overflow-hidden"
              >
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Create Staff Account</h4>
                  <button type="button" onClick={() => setShowUserForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input name="username" required placeholder="Username" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                <input name="password" required type="password" placeholder="Password" minLength={4} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                <select name="role" required className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500">
                  <option value="volunteer">Volunteer</option>
                  <option value="admin">Admin</option>
                </select>
                <button type="submit" disabled={addingUser} className="w-full bg-red-600 text-white font-medium py-2.5 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50">
                  {addingUser ? 'Creating...' : 'Create Account'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {!showUserForm && (
            <button onClick={() => setShowUserForm(true)} className="flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 py-3 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-dashed border-gray-300 dark:border-gray-700">
              <UserPlus className="w-4 h-4" /> Add Staff Member
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
