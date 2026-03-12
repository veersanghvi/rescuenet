import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16">
      <div className="text-6xl font-bold text-slate-200 dark:text-slate-800">404</div>
      <div className="text-center">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Page not found</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">The page you're looking for doesn't exist.</p>
      </div>
      <Link to="/" className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium py-2.5 px-5 rounded-lg hover:opacity-90 transition-opacity text-sm">
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>
    </div>
  );
}
