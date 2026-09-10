import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { Article, FeedbackType } from '../types';

async function fetchArticle(id: string): Promise<Article> {
  const { data, error } = await supabase.from('articles').select('*').eq('id', id).single();
  if (error) throw error;
  return data as unknown as Article;
}

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: article } = useQuery({ queryKey: ['article', id], queryFn: () => fetchArticle(id!), enabled: !!id });

  const feedbackMutation = useMutation({
    mutationFn: async (type: FeedbackType) => {
      const { error } = await supabase
        .from('feedback')
        .insert({ article_id: id, submitted_by: profile?.id, type });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['article', id] }),
  });

  if (!article) return <p className="text-sm text-ink-700/50">Loading…</p>;

  return (
    <article className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold">{article.title}</h1>
      <p className="text-sm text-ink-700/50 dark:text-paper-100/40 mt-1">
        Last reviewed {article.updated_at ? new Date(article.updated_at).toLocaleDateString() : '—'}
      </p>
      <div className="prose prose-sm dark:prose-invert max-w-none mt-6 whitespace-pre-wrap">{article.body}</div>

      <div className="mt-10 border-t border-black/5 dark:border-white/10 pt-6">
        <p className="text-sm font-medium mb-3">Was this article helpful?</p>
        <div className="flex gap-2">
          <button
            onClick={() => feedbackMutation.mutate('helpful')}
            className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm hover:bg-signal-teal/10 hover:border-signal-teal transition-colors"
          >
            👍 Helpful
          </button>
          <button
            onClick={() => feedbackMutation.mutate('not_helpful')}
            className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm hover:bg-signal-coral/10 hover:border-signal-coral transition-colors"
          >
            👎 Not helpful
          </button>
          <button
            onClick={() => feedbackMutation.mutate('outdated')}
            className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm hover:bg-signal-amber/10 hover:border-signal-amber transition-colors"
          >
            ⚠ Report outdated
          </button>
        </div>
        {feedbackMutation.isSuccess && (
          <p className="text-xs text-signal-teal mt-2">Thanks — your feedback was recorded.</p>
        )}
      </div>
    </article>
  );
}
