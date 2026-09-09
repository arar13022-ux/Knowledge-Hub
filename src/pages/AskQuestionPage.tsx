import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { classifyMatches, findDuplicateQuestion, matchQuestion, normalizeQuestion } from '../lib/matching';
import type { Article } from '../types';

type Outcome =
  | { kind: 'auto_answer'; articles: Article[] }
  | { kind: 'queued' }
  | { kind: 'duplicate' };

export default function AskQuestionPage() {
  const { profile } = useAuth();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || !profile) return;
    setSubmitting(true);
    setOutcome(null);
    try {
      const normalized = normalizeQuestion(text);
      const duplicateOf = await findDuplicateQuestion(normalized);
      const matches = await matchQuestion(text);
      const tier = classifyMatches(matches);

      const { data: question, error } = await supabase
        .from('questions')
        .insert({
          asked_by: profile.id,
          raw_text: text,
          normalized_text: normalized,
          status: duplicateOf ? 'duplicate' : tier === 'auto_answer' ? 'auto_answered' : 'queued',
          duplicate_of: duplicateOf,
        })
        .select()
        .single();
      if (error) throw error;

      if (matches.length) {
        await supabase.from('question_matches').insert(
          matches.map((m) => ({
            question_id: question.id,
            article_id: m.articleId,
            score: m.score,
            matched_on: m.matchedOn,
          }))
        );
      }

      if (duplicateOf) {
        setOutcome({ kind: 'duplicate' });
      } else if (tier === 'auto_answer') {
        const { data: articles } = await supabase
          .from('articles')
          .select('*')
          .in('id', matches.slice(0, 3).map((m) => m.articleId));
        setOutcome({ kind: 'auto_answer', articles: (articles ?? []) as unknown as Article[] });
      } else {
        setOutcome({ kind: 'queued' });
      }
      setText('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-2xl font-bold">Ask a question</h1>
      <p className="text-ink-700/60 dark:text-paper-100/50 text-sm mt-1 mb-6">
        We'll check approved knowledge first. Anything we can't answer goes straight to a specialist.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          required
          placeholder="e.g. What's the process for a customer return without a receipt?"
          className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-ink-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-signal-teal"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-signal-teal text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {submitting ? 'Checking approved sources…' : 'Submit question'}
        </button>
      </form>

      {outcome?.kind === 'auto_answer' && (
        <div className="mt-6 rounded-xl border border-signal-teal/30 bg-signal-teal/5 p-4">
          <p className="text-sm font-medium text-signal-teal mb-2">Matched from an approved source</p>
          <ul className="space-y-2">
            {outcome.articles.map((a) => (
              <li key={a.id}>
                <Link to={`/articles/${a.id}`} className="text-sm underline hover:no-underline">
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {outcome?.kind === 'queued' && (
        <div className="mt-6 rounded-xl border border-signal-amber/30 bg-signal-amber/5 p-4 text-sm">
          No approved answer covers this yet. It's been sent to the right team — you'll get a notification
          the moment it's answered.
        </div>
      )}
      {outcome?.kind === 'duplicate' && (
        <div className="mt-6 rounded-xl border border-black/10 dark:border-white/10 p-4 text-sm">
          Someone already asked this recently. You'll be notified when it's resolved.
        </div>
      )}
    </div>
  );
}
