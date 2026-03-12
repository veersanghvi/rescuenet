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
      <div className="text-6xl font-bold text-gray-200 dark:text-gray-800">404</div>
      <div className="text-center">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Page not found</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">The page you're looking for doesn't exist.</p>
      </div>
      <Link to="/" className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium py-2.5 px-5 rounded-xl hover:opacity-90 transition-opacity">
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>
    </motion.div>
  );
}
