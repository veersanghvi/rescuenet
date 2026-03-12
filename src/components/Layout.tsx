import { Outlet, Link, useLocation } from 'react-router-dom';
import { ShieldAlert, Settings, Search, Moon, Sun } from 'lucide-react';
import { useTheme } from './Theme';

export default function Layout() {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans flex flex-col">
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-red-600 dark:text-red-500 font-bold text-lg">
            <ShieldAlert className="w-6 h-6" />
            <span>RescueNet</span>
          </Link>
          <nav className="flex items-center gap-1">
            <button
              onClick={toggle}
              className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <Link 
              to="/track" 
              className={`p-2 rounded-xl transition-colors ${location.pathname === '/track' ? 'text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-500/10' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              title="Track Case"
            >
              <Search className="w-5 h-5" />
            </Link>
            <Link 
              to="/admin" 
              className={`p-2 rounded-xl transition-colors ${location.pathname === '/admin' ? 'text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-500/10' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              title="Admin"
            >
              <Settings className="w-5 h-5" />
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full max-w-lg mx-auto p-4 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
