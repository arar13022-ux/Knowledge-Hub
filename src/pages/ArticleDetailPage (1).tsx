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

async function fetchMyFeedback(articleId: string, profileId: string) {
  const { data, error } = await supabase
    .from('feedback')
    .select('type')
    .eq('article_id', articleId)
    .eq('submitted_by', profileId);
  if (error) throw error;
  return (data ?? []).map((f) => f.type as FeedbackType);
}

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: article, isLoading, isError } = useQuery({
    queryKey: ['article', id],
    queryFn: () => fetchArticle(id!),
    enabled: !!id,
    retry: false,
  });

  const { data: myFeedback } = useQuery({
    queryKey: ['my-feedback', id, profile?.id],
    queryFn: () => fetchMyFeedback(id!, profile!.id),
    enabled: !!id && !!profile?.id,
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({ type, note }: { type: FeedbackType; note?: string }) => {
      const { error } = await supabase
        .from('feedback')
        .insert({ article_id: id, submitted_by: profile?.id, type, note: note ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', id] });
      queryClient.invalidateQueries({ queryKey: ['my-feedback', id, profile?.id] });
    },
  });

  const hasGiven = (type: FeedbackType) => myFeedback?.includes(type) ?? false;
  const hasRatedHelpfulness = hasGiven('helpful') || hasGiven('not_helpful');

  function handleOutdated() {
    if (hasGiven('outdated')) return;
    const note = window.prompt('What\'s outdated about this article? (optional)') ?? undefined;
    feedbackMutation.mutate({ type: 'outdated', note });
  }

  if (isLoading) return <p className="text-sm text-ink-700/50">Loading…</p>;
  if (isError || !article) {
    return (
      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-ink-900 p-6">
        <p className="text-sm font-medium">This article is no longer available.</p>
        <p className="text-sm text-ink-700/60 dark:text-paper-100/50 mt-1">
          It may have been unpublished or removed. Try searching the Knowledge base for something similar.
        </p>
      </div>
    );
  }

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
            onClick={() => feedbackMutation.mutate({ type: 'helpful' })}
            disabled={hasRatedHelpfulness}
            className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm hover:bg-signal-teal/10 hover:border-signal-teal transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
          >
            👍 {hasGiven('helpful') ? 'Marked helpful' : 'Helpful'}
          </button>
          <button
            onClick={() => feedbackMutation.mutate({ type: 'not_helpful' })}
            disabled={hasRatedHelpfulness}
            className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm hover:bg-signal-coral/10 hover:border-signal-coral transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
          >
            👎 {hasGiven('not_helpful') ? 'Marked not helpful' : 'Not helpful'}
          </button>
          <button
            onClick={handleOutdated}
            disabled={hasGiven('outdated')}
            className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm hover:bg-signal-amber/10 hover:border-signal-amber transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
          >
            ⚠ {hasGiven('outdated') ? 'Reported outdated' : 'Report outdated'}
          </button>
        </div>
        {feedbackMutation.isSuccess && (
          <p className="text-xs text-signal-teal mt-2">Thanks — your feedback was recorded.</p>
        )}
      </div>
    </article>
  );
}
