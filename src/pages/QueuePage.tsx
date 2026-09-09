import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { Question } from '../types';

async function fetchQueue(): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Question[];
}

function QueueItem({ question }: { question: Question }) {
  const { profile, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');

  const submitDraft = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('answers').insert({
        question_id: question.id,
        body: draft,
        authored_by: profile?.id,
        status: hasRole('admin') ? 'approved' : 'draft',
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue'] }),
  });

  const publish = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('questions')
        .update({ status: 'answered' })
        .eq('id', question.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue'] }),
  });

  return (
    <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-ink-900 p-4">
      <p className="text-sm font-medium">{question.raw_Text}</p>
      <p className="text-xs text-ink-700/50 dark:text-paper-100/40 mt-1">
        Asked {new Date(question.created_At).toLocaleString()}
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        placeholder="Draft an answer, citing the approved source it comes from…"
        className="w-full mt-3 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal-teal"
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => submitDraft.mutate()}
          disabled={!draft.trim()}
          className="rounded-lg bg-signal-teal text-white px-3 py-1.5 text-sm font-medium disabled:opacity-40"
        >
          {hasRole('admin') ? 'Approve & save' : 'Submit for approval'}
        </button>
        {hasRole('admin') && (
          <button
            onClick={() => publish.mutate()}
            className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm"
          >
            Publish to agent
          </button>
        )}
      </div>
    </div>
  );
}

export default function QueuePage() {
  const { data: queue, isLoading } = useQuery({ queryKey: ['queue'], queryFn: fetchQueue });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">Review queue</h1>
      <p className="text-ink-700/60 dark:text-paper-100/50 text-sm mb-6">
        Questions with no confident match in the knowledge base. Draft, approve, publish.
      </p>
      {isLoading && <p className="text-sm text-ink-700/50">Loading…</p>}
      <div className="space-y-3">
        {queue?.map((q) => (
          <QueueItem key={q.id} question={q} />
        ))}
        {queue?.length === 0 && !isLoading && (
          <p className="text-sm text-ink-700/50">Queue is empty — nice work.</p>
        )}
      </div>
    </div>
  );
}
