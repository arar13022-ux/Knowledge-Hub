import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

type QuestionRow = { id: string; raw_text: string; duplicate_of: string | null };

type Cluster = {
  canonicalId: string;
  canonicalText: string;
  duplicates: { id: string; raw_text: string }[];
};

async function fetchCounts() {
  const [unanswered, aging, duplicateQuestions] = await Promise.all([
    supabase.from('v_unanswered_questions').select('*', { count: 'exact', head: true }),
    supabase.from('v_aging_articles').select('*', { count: 'exact', head: true }),
    supabase.from('questions').select('id, raw_text, duplicate_of').not('duplicate_of', 'is', null),
  ]);

  const dupes = (duplicateQuestions.data ?? []) as QuestionRow[];
  const canonicalIds = [...new Set(dupes.map((d) => d.duplicate_of as string))];

  let canonicalQuestions: QuestionRow[] = [];
  if (canonicalIds.length > 0) {
    const { data } = await supabase.from('questions').select('id, raw_text, duplicate_of').in('id', canonicalIds);
    canonicalQuestions = (data ?? []) as QuestionRow[];
  }

  const clusters: Cluster[] = canonicalIds.map((canonicalId) => ({
    canonicalId,
    canonicalText: canonicalQuestions.find((q) => q.id === canonicalId)?.raw_text ?? 'Untitled question',
    duplicates: dupes
      .filter((d) => d.duplicate_of === canonicalId)
      .map((d) => ({ id: d.id, raw_text: d.raw_text })),
  })).sort((a, b) => b.duplicates.length - a.duplicates.length);

  return {
    unansweredCount: unanswered.count ?? 0,
    agingCount: aging.count ?? 0,
    duplicateClusters: clusters,
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
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['analytics'], queryFn: fetchCounts });

  const dismissCluster = useMutation({
    mutationFn: async (canonicalId: string) => {
      const { error } = await supabase.from('questions').update({ duplicate_of: null }).eq('duplicate_of', canonicalId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['analytics'] }),
  });

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
        {isLoading && <p className="text-sm text-ink-700/50">Loading…</p>}
        {!isLoading && data?.duplicateClusters.length === 0 && (
          <p className="text-sm text-ink-700/50">No duplicate clusters — nice.</p>
        )}
        <div className="space-y-4">
          {data?.duplicateClusters.map((cluster) => (
            <div key={cluster.canonicalId} className="border-t border-black/5 dark:border-white/10 pt-4 first:border-t-0 first:pt-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{cluster.canonicalText}</p>
                  <p className="text-xs text-ink-700/40 dark:text-paper-100/30 mt-0.5">
                    {cluster.duplicates.length} similar question{cluster.duplicates.length === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  onClick={() => dismissCluster.mutate(cluster.canonicalId)}
                  className="shrink-0 rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-medium"
                >
                  Dismiss
                </button>
              </div>
              <ul className="mt-2 space-y-1">
                {cluster.duplicates.map((d) => (
                  <li key={d.id} className="text-sm text-ink-700/60 dark:text-paper-100/50">
                    · {d.raw_text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
