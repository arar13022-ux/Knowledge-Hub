import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

type FeedbackRow = {
  id: string;
  type: 'helpful' | 'not_helpful' | 'outdated';
  note: string | null;
  created_at: string;
  articles: { id: string; title: string; status: string } | null;
  profiles: { full_name: string; role: string } | null;
};

async function fetchFeedback(): Promise<FeedbackRow[]> {
  const { data, error } = await supabase
    .from('feedback')
    .select('id, type, note, created_at, articles(id, title, status), profiles(full_name, role)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as FeedbackRow[];
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-ink-900 p-5">
      <p className="text-sm text-ink-700/60 dark:text-paper-100/50">{label}</p>
      <p className={`font-display text-3xl font-bold mt-1 ${tone}`}>{value}</p>
    </div>
  );
}

export default function FeedbackPage() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const { data: feedback, isLoading } = useQuery({ queryKey: ['feedback'], queryFn: fetchFeedback });

  const setStatus = useMutation({
    mutationFn: async ({ articleId, status }: { articleId: string; status: 'archived' | 'published' }) => {
      const { error } = await supabase.from('articles').update({ status }).eq('id', articleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });

  const deleteArticle = useMutation({
    mutationFn: async (articleId: string) => {
      const { error } = await supabase.from('articles').delete().eq('id', articleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });

  const helpfulCount = feedback?.filter((f) => f.type === 'helpful').length ?? 0;
  const notHelpfulCount = feedback?.filter((f) => f.type === 'not_helpful').length ?? 0;
  const outdated = feedback?.filter((f) => f.type === 'outdated') ?? [];

  const byArticle = new Map<string, { title: string; helpful: number; notHelpful: number }>();
  feedback?.forEach((f) => {
    if (!f.articles || f.type === 'outdated') return;
    const entry = byArticle.get(f.articles.id) ?? { title: f.articles.title, helpful: 0, notHelpful: 0 };
    if (f.type === 'helpful') entry.helpful += 1;
    if (f.type === 'not_helpful') entry.notHelpful += 1;
    byArticle.set(f.articles.id, entry);
  });
  const articleRows = Array.from(byArticle.values()).sort(
    (a, b) => b.helpful + b.notHelpful - (a.helpful + a.notHelpful)
  );

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">Feedback</h1>
      <p className="text-ink-700/60 dark:text-paper-100/50 text-sm mb-6">
        How people are reacting to articles, and what they've flagged as outdated.
      </p>

      {isLoading && <p className="text-sm text-ink-700/50">Loading…</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Helpful reactions" value={helpfulCount} tone="text-signal-teal" />
        <StatCard label="Not helpful reactions" value={notHelpfulCount} tone="text-signal-coral" />
        <StatCard label="Outdated reports" value={outdated.length} tone="text-signal-amber" />
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-ink-900 p-5 mb-6">
        <p className="text-sm font-medium mb-4">Outdated reports</p>
        {outdated.length === 0 && !isLoading && (
          <p className="text-sm text-ink-700/50">No outdated reports — nice.</p>
        )}
        <div className="space-y-3">
          {outdated.map((f) => {
            const isArchived = f.articles?.status === 'archived';
            return (
              <div key={f.id} className="border-t border-black/5 dark:border-white/10 pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{f.articles?.title ?? 'Untitled article'}</p>
                    {isArchived && (
                      <span className="text-[10px] uppercase tracking-wide text-ink-700/40 dark:text-paper-100/30 border border-black/10 dark:border-white/10 rounded px-1.5 py-0.5">
                        Unpublished
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-ink-700/50 dark:text-paper-100/40 capitalize">
                    {f.profiles?.full_name ?? 'Unknown user'}
                    {f.profiles?.role ? ` · ${f.profiles.role.replace('_', ' ')}` : ''}
                  </span>
                </div>
                {f.note && <p className="text-sm text-ink-700/60 dark:text-paper-100/50 mt-1">{f.note}</p>}
                <p className="text-xs text-ink-700/40 dark:text-paper-100/30 mt-1">
                  Reported {new Date(f.created_at).toLocaleDateString()}
                </p>
                {f.articles && (
                  <div className="flex gap-2 mt-2">
                    {isArchived ? (
                      <button
                        onClick={() => setStatus.mutate({ articleId: f.articles!.id, status: 'published' })}
                        className="rounded-lg bg-signal-teal text-white px-3 py-1.5 text-xs font-medium"
                      >
                        Republish
                      </button>
                    ) : (
                      <button
                        onClick={() => setStatus.mutate({ articleId: f.articles!.id, status: 'archived' })}
                        className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-medium"
                      >
                        Unpublish
                      </button>
                    )}
                    {hasRole('admin') && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Permanently delete "${f.articles!.title}"? This also removes its feedback, keywords, and version history. This can't be undone.`)) {
                            deleteArticle.mutate(f.articles!.id);
                          }
                        }}
                        className="rounded-lg border border-signal-coral/30 text-signal-coral px-3 py-1.5 text-xs font-medium"
                      >
                        Delete permanently
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-ink-900 p-5">
        <p className="text-sm font-medium mb-4">Helpful vs. not helpful, by article</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-700/50 dark:text-paper-100/40">
              <th className="pb-2 font-normal">Article</th>
              <th className="pb-2 font-normal">Helpful</th>
              <th className="pb-2 font-normal">Not helpful</th>
            </tr>
          </thead>
          <tbody>
            {articleRows.map((row) => (
              <tr key={row.title} className="border-t border-black/5 dark:border-white/10">
                <td className="py-2">{row.title}</td>
                <td className="py-2 text-signal-teal">{row.helpful}</td>
                <td className="py-2 text-signal-coral">{row.notHelpful}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {articleRows.length === 0 && !isLoading && (
          <p className="text-sm text-ink-700/50">No reactions yet.</p>
        )}
      </div>
    </div>
  );
}
