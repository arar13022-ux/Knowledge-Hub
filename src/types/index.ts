export type UserRole = 'admin' | 'team_lead' | 'agent';

export interface Profile {
  id: string;
  fullName: string;
  role: UserRole;
  team: string | null;
  avatarUrl: string | null;
  accessGroupIds: string[];
}

export type ArticleStatus = 'draft' | 'pending_review' | 'published' | 'archived';

export interface Article {
  id: string;
  title: string;
  summary: string;
  body: string;
  categoryId: string;
  accessGroupId: string | null;
  status: ArticleStatus;
  ownerId: string;
  review_due_at: string | null;
  keywords: string[];
  updated_at: string;
  helpfulCount: number;
  notHelpfulCount: number;
}

export interface ArticleVersion {
  id: string;
  articleId: string;
  versionNumber: number;
  title: string;
  body: string;
  editedBy: string;
  created_at: string;
}

export type QuestionStatus = 'auto_answered' | 'queued' | 'answered' | 'duplicate';

export interface Question {
  id: string;
  askedBy: string;
  raw_text: string;
  categoryId: string | null;
  status: QuestionStatus;
  created_at: string;
  duplicateOf?: string;
}

export type AnswerStatus = 'draft' | 'approved' | 'published';

export interface Answer {
  id: string;
  questionId: string;
  body: string;
  sourceArticleId: string | null;
  authoredBy: string;
  approvedBy: string | null;
  status: AnswerStatus;
  created_at: string;
}

export type FeedbackType = 'helpful' | 'not_helpful' | 'outdated';

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

export interface Notification {
  id: string;
  type: 'answered' | 'article_updated' | 'queue_assigned' | 'review_due';
  message: string;
  read: boolean;
  created_at: string;
}
