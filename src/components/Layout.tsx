import { Outlet, Link, useLocation } from 'react-router-dom';
import { Search, Moon, Sun, LogIn, LogOut } from 'lucide-react';
import { useTheme } from './Theme';
import { useAuth } from './Auth';

export default function Layout() {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();

  const navLink = (to: string, label: string) => {
    const active = location.pathname === to;
    return (
      <Link
        to={to}
        className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
          active
            ? 'text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        {label}
      </Link>
    );
  };
  
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5">
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">rescue</span>
            <span className="text-lg font-bold tracking-tight text-teal-600 dark:text-teal-400">near</span>
          </Link>
          <nav className="flex items-center gap-1">
            <div className="hidden sm:flex items-center gap-1 mr-2">
              {navLink('/track', 'Track')}
              {user && user.role === 'admin' && navLink('/admin', 'Admin')}
              {user && navLink('/volunteer', 'Volunteer')}
            </div>
            <div className="flex sm:hidden items-center gap-1">
              <Link 
                to="/track" 
                className={`p-2 rounded-lg transition-colors ${location.pathname === '/track' ? 'text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <Search className="w-4 h-4" />
              </Link>
            </div>
            <button
              onClick={toggle}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {user ? (
              <button
                onClick={logout}
                className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <Link
                to="/login"
                className={`p-2 rounded-lg transition-colors ${location.pathname === '/login' ? 'text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <LogIn className="w-4 h-4" />
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
