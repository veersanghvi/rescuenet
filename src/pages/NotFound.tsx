import { motion } from 'motion/react';
import { Home, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center gap-6 py-16"
    >
      <div className="text-6xl font-bold text-stone-200">404</div>
      <div className="text-center">
        <h2 className="text-lg font-bold text-stone-800">Page not found</h2>
        <p className="text-sm text-stone-500 mt-1">The page you're looking for doesn't exist.</p>
      </div>
      <Link to="/" className="flex items-center gap-2 bg-stone-900 text-white font-medium py-2.5 px-5 rounded-xl hover:bg-stone-800 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>
    </motion.div>
  );
}
