import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '../lib/supabaseClient';

async function fetchCounts() {
  const [unanswered, aging, duplicates] = await Promise.all([
    supabase.from('v_unanswered_questions').select('*', { count: 'exact', head: true }),
    supabase.from('v_aging_articles').select('*', { count: 'exact', head: true }),
    supabase.from('v_duplicate_clusters').select('*'),
  ]);
  return {
    unansweredCount: unanswered.count ?? 0,
    agingCount: aging.count ?? 0,
    duplicateClusters: duplicates.data ?? [],
  };
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-ink-900 p-5">
      <p className="text-sm text-ink-700/60 dark:text-paper-100/50">{label}</p>
      <p className={`font-display text-3xl font-bold mt-1 ${tone}`}>{value}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data } = useQuery({ queryKey: ['analytics'], queryFn: fetchCounts });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-6">Knowledge operations</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Unanswered questions" value={data?.unansweredCount ?? 0} tone="text-signal-coral" />
        <StatCard label="Articles due for review" value={data?.agingCount ?? 0} tone="text-signal-amber" />
        <StatCard label="Duplicate question clusters" value={data?.duplicateClusters.length ?? 0} tone="text-signal-teal" />
      </div>
      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-ink-900 p-5">
        <p className="text-sm font-medium mb-4">Top duplicate clusters (biggest knowledge gaps)</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data?.duplicateClusters.slice(0, 8) ?? []}>
            <XAxis dataKey="canonical_question_id" hide />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="duplicate_count" fill="#0F9D8C" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
