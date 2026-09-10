import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { Article } from '../types';

async function fetchArticles(search: string): Promise<Article[]> {
  let query = supabase.from('articles').select('*').eq('status', 'published').order('updated_at', { ascending: false });
  if (search.trim()) {
    query = query.textSearch('search_vector', search, { type: 'plain' });
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Article[];
}

export default function KnowledgeBasePage() {
  const [search, setSearch] = useState('');
  const { data: articles, isLoading } = useQuery({
    queryKey: ['articles', search],
    queryFn: () => fetchArticles(search),
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Knowledge base</h1>
        <p className="text-ink-700/60 dark:text-paper-100/50 text-sm mt-1">
          Approved, reviewed answers for retail operations.
        </p>
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search articles, e.g. “return policy”, “POS reboot”…"
        className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-ink-900 px-4 py-3 text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-signal-teal"
      />
      {isLoading && <p className="text-sm text-ink-700/50">Loading articles…</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {articles?.map((article) => (
          <Link
            key={article.id}
            to={`/articles/${article.id}`}
            className="block rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-ink-900 p-4 hover:border-signal-teal/50 transition-colors"
          >
            <h3 className="font-medium">{article.title}</h3>
            <p className="text-sm text-ink-700/60 dark:text-paper-100/50 mt-1 line-clamp-2">{article.summary}</p>
            {article.review_due_at && new Date(article.review_due_at) < new Date() && (
              <span className="inline-block mt-2 text-xs text-signal-amber">Due for review</span>
            )}
          </Link>
        ))}
        {articles?.length === 0 && !isLoading && (
          <p className="text-sm text-ink-700/50 col-span-2">
            No articles match that search. Try “Ask a question” to route this to a specialist.
          </p>
        )}
      </div>
    </div>
  );
}
