import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Shield, Ban, Package } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

type Species = 'dog' | 'cat' | 'bird' | 'wildlife' | 'other';

interface Guide {
  title: string;
  urgent: string[];
  avoid: string[];
  supplies: string[];
}

const SPECIES_OPTIONS: Array<{ value: Species; label: string }> = [
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
  { value: 'bird', label: 'Bird' },
  { value: 'wildlife', label: 'Wildlife' },
  { value: 'other', label: 'Other' },
];

export default function UntilHelp() {
  const { toast } = useToast();
  const [species, setSpecies] = useState<Species>('dog');
  const [guide, setGuide] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/first-aid?species=${species}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (active) setGuide(data.guide || null);
      } catch {
        if (active) toast('Failed to load guidance', 'error');
      } finally {
        if (active) setLoading(false);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [species]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 max-w-3xl w-full mx-auto">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="flex items-center gap-3">
        <Link to="/" className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-xl text-[#1F2937] dark:text-white">Until help arrives</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Calm, practical steps for the first 10 minutes</p>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="bg-[#FFF3E8] border border-[#F4A261]/45 rounded-lg p-3.5 text-[#8A4B12] text-sm flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        Prioritize your safety first. If the animal is aggressive or wildlife is involved, keep distance and wait for trained responders.
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col gap-2">
        <label htmlFor="species" className="text-sm font-medium text-slate-700 dark:text-slate-300">Animal type</label>
        <select
          id="species"
          value={species}
          onChange={(e) => setSpecies(e.target.value as Species)}
          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2A9D8F]/25 focus:border-[#2A9D8F]"
        >
          {SPECIES_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </motion.div>

      {loading ? (
        <div className="grid sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse" />
          ))}
        </div>
      ) : guide ? (
        <>
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="grid sm:grid-cols-3 gap-3">
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#2A9D8F]" />
                Do now
              </h2>
              <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1.5">
                {guide.urgent.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </section>

            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Ban className="w-4 h-4 text-[#E63946]" />
                Avoid
              </h2>
              <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1.5">
                {guide.avoid.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </section>

            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                Useful items
              </h2>
              <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1.5">
                {guide.supplies.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </section>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-sm text-slate-700 dark:text-slate-300">
            If possible, submit a rescue report immediately so responders can locate you faster.
            <Link to="/report" className="ml-1 text-[#E63946] font-semibold hover:underline">Open report form</Link>
          </motion.div>
        </>
      ) : null}
    </motion.div>
  );
}
