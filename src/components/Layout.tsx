import { Outlet, Link, useLocation } from 'react-router-dom';
import { ShieldAlert, Settings, Search } from 'lucide-react';

export default function Layout() {
  const location = useLocation();
  
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans flex flex-col">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-red-600 font-bold text-lg">
            <ShieldAlert className="w-6 h-6" />
            <span>RescueNet</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link 
              to="/track" 
              className={`p-2 rounded-lg transition-colors ${location.pathname === '/track' ? 'text-red-600 bg-red-50' : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'}`}
              title="Track Case"
            >
              <Search className="w-5 h-5" />
            </Link>
            <Link 
              to="/admin" 
              className={`p-2 rounded-lg transition-colors ${location.pathname === '/admin' ? 'text-red-600 bg-red-50' : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'}`}
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
