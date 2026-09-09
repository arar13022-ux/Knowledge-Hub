import { supabase } from './supabaseClient';

export interface MatchResult {
  articleId: string;
  score: number;
  matchedOn: 'keyword' | 'fulltext';
}

const HIGH_CONFIDENCE_THRESHOLD = 6;
const LOW_CONFIDENCE_THRESHOLD = 2;

export type MatchTier = 'auto_answer' | 'suggest_and_queue' | 'queue';

export function classifyMatches(matches: MatchResult[]): MatchTier {
  const top = matches[0]?.score ?? 0;
  if (top >= HIGH_CONFIDENCE_THRESHOLD) return 'auto_answer';
  if (top >= LOW_CONFIDENCE_THRESHOLD) return 'suggest_and_queue';
  return 'queue';
}

/**
 * Calls the `match_question` Postgres function (see supabase/schema.sql).
 * All scoring happens in the database — deterministic, explainable, and
 * built only from company-approved article content already in the KB.
 */
export async function matchQuestion(questionText: string): Promise<MatchResult[]> {
  const { data, error } = await supabase.rpc('match_question', {
    p_question_text: questionText,
  });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    articleId: row.article_id,
    score: Number(row.score),
    matchedOn: row.matched_on,
  }));
}

export async function findDuplicateQuestion(normalizedText: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('find_duplicate_question', {
    p_normalized: normalizedText,
  });
  if (error) throw error;
  return data ?? null;
}

export function normalizeQuestion(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}
