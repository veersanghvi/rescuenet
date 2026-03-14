import { useEffect, useState } from 'react';
import { ArrowLeft, Search, Phone, HandHeart, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { authHeaders, useAuth } from '../components/Auth';

type ReportType = 'lost' | 'found';

interface LostFoundPost {
  id: number;
  report_type: ReportType;
  species: string;
  title: string;
  description: string | null;
  area: string;
  last_seen_at: string | null;
  contact_name: string;
  contact_phone: string;
  status: 'open' | 'resolved';
  created_at: string;
}

export default function LostFound() {
  const { toast } = useToast();
  const { user, token } = useAuth();

  const [posts, setPosts] = useState<LostFoundPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'all' | ReportType>('all');
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const [submitting, setSubmitting] = useState(false);

  const loadPosts = async (overrides?: { q?: string; type?: 'all' | ReportType; status?: 'open' | 'resolved' }) => {
    setLoading(true);
    const q = overrides?.q ?? search;
    const qType = overrides?.type ?? type;
    const qStatus = overrides?.status ?? status;

    try {
      const params = new URLSearchParams();
      if (q.trim()) params.append('q', q.trim());
      if (qType !== 'all') params.append('type', qType);
      params.append('status', qStatus);

      const res = await fetch(`/api/lost-found?${params.toString()}`);
      if (!res.ok) throw new Error();
      setPosts(await res.json());
    } catch {
      toast('Failed to load posts', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      loadPosts();
    }, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, type, status]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    setSubmitting(true);
    try {
      const res = await fetch('/api/lost-found', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: fd.get('report_type'),
          species: fd.get('species'),
          title: fd.get('title'),
          description: fd.get('description'),
          area: fd.get('area'),
          last_seen_at: fd.get('last_seen_at'),
          contact_name: fd.get('contact_name'),
          contact_phone: fd.get('contact_phone'),
        }),
      });
      if (!res.ok) throw new Error();
      toast('Posted successfully', 'success');
      (e.currentTarget as HTMLFormElement).reset();
      loadPosts();
    } catch {
      toast('Failed to post', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: number, next: 'open' | 'resolved') => {
    try {
      const res = await fetch(`/api/lost-found/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      toast('Status updated', 'success');
      loadPosts();
    } catch {
      toast('Could not update status', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-xl text-slate-900 dark:text-white">Lost & found animals</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Community bulletin for reunions and verified sightings</p>
        </div>
      </div>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col gap-3">
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by area, species, or title"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>
          <select value={type} onChange={(e) => setType(e.target.value as 'all' | ReportType)} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm">
            <option value="all">All posts</option>
            <option value="lost">Lost</option>
            <option value="found">Found</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'open' | 'resolved')} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm">
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4 items-start">
        <div className="flex flex-col gap-3">
          {loading ? (
            [1, 2, 3].map((i) => <div key={i} className="h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg animate-pulse" />)
          ) : posts.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
              No posts in this view yet.
            </div>
          ) : (
            posts.map((post) => (
              <article key={post.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-medium ${post.report_type === 'lost' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'}`}>
                      {post.report_type}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {post.species}
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium uppercase tracking-wider ${post.status === 'open' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>
                    {post.status}
                  </span>
                </div>

                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{post.title}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{post.area} {post.last_seen_at ? `• ${post.last_seen_at}` : ''}</p>
                {post.description ? <p className="text-sm text-slate-600 dark:text-slate-300">{post.description}</p> : null}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a href={`tel:${post.contact_phone}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-100 hover:text-teal-700 dark:hover:text-teal-400">
                    <Phone className="w-3.5 h-3.5" /> {post.contact_name}: {post.contact_phone}
                  </a>
                  {user && (
                    <button
                      onClick={() => updateStatus(post.id, post.status === 'open' ? 'resolved' : 'open')}
                      className="text-xs border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Mark {post.status === 'open' ? 'resolved' : 'open'}
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>

        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col gap-2.5 sticky top-20">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            Post lost/found report
          </h3>
          <select name="report_type" required className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm">
            <option value="lost">Lost</option>
            <option value="found">Found</option>
          </select>
          <input name="species" required placeholder="Species (dog, cat, bird...)" className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm" />
          <input name="title" required placeholder="Short title" className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm" />
          <input name="area" required placeholder="Area / landmark" className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm" />
          <input name="last_seen_at" placeholder="Last seen (optional)" className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm" />
          <input name="contact_name" required placeholder="Contact name" className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm" />
          <input name="contact_phone" required placeholder="Contact phone" className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm" />
          <textarea name="description" rows={3} placeholder="Description" className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm resize-none" />

          <button disabled={submitting} type="submit" className="bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
            <HandHeart className="w-4 h-4" />
            {submitting ? 'Posting...' : 'Publish report'}
          </button>
        </form>
      </section>
    </div>
  );
}
