import { Outlet, Link, useLocation } from 'react-router-dom';
import { Search, Moon, Sun, LogIn, LogOut, HeartHandshake, LifeBuoy } from 'lucide-react';
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
            ? 'text-[#E63946] bg-[#FEECEE]'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        {label}
      </Link>
    );
  };
  
  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-slate-950 text-[#1F2937] dark:text-slate-100 font-sans flex flex-col">
      <header className="bg-white dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/rescuenear-mark.svg" alt="rescuenear" className="h-8 w-8" />
            <div className="leading-none">
              <div className="text-sm font-bold tracking-tight text-[#1F2937] dark:text-slate-100">rescue</div>
              <div className="text-sm font-bold tracking-tight text-[#2A9D8F]">near.me</div>
            </div>
          </Link>
          <nav className="flex items-center gap-1">
            <div className="hidden sm:flex items-center gap-1 mr-2">
              {navLink('/track', 'Track')}
              {navLink('/until-help', 'Until Help')}
              {navLink('/lost-found', 'Lost & Found')}
              {user && user.role === 'admin' && navLink('/admin', 'Admin')}
              {user && navLink('/volunteer', 'Volunteer')}
            </div>
            <div className="flex sm:hidden items-center gap-1">
              <Link 
                to="/track" 
                className={`p-2 rounded-lg transition-colors ${location.pathname === '/track' ? 'text-[#E63946] bg-[#FEECEE]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <Search className="w-4 h-4" />
              </Link>
              <Link 
                to="/until-help" 
                className={`p-2 rounded-lg transition-colors ${location.pathname === '/until-help' ? 'text-[#E63946] bg-[#FEECEE]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <LifeBuoy className="w-4 h-4" />
              </Link>
              <Link 
                to="/lost-found" 
                className={`p-2 rounded-lg transition-colors ${location.pathname === '/lost-found' ? 'text-[#E63946] bg-[#FEECEE]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <HeartHandshake className="w-4 h-4" />
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
                className={`p-2 rounded-lg transition-colors ${location.pathname === '/login' ? 'text-[#E63946] bg-[#FEECEE]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
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
