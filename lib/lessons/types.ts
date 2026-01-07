// Lesson content structure (JSONB in database, but defined here to avoid circular imports)
export interface LessonContent {
  introduction: string;
  keyPrinciples: string[];
  goodExample: {
    prompt: string;
    output: string;
    explanation: string;
  };
  badExample: {
    prompt: string;
    output: string;
    whyBad: string;
  };
  scenario: string;
  targetBehavior: string;
  evaluationCriteria: {
    criterion: string;
    weight: number;
    description: string;
  }[];
  hints: string[];
  modelConfig?: {
    temperature: number;
    topK?: number;
    topP?: number;
  };
}

export interface EvaluationFeedback {
  strengths: string[];
  improvements: string[];
  revisedPromptSuggestion?: string;
}

export interface EvaluationDetails {
  criteriaScores: {
    criterion: string;
    score: number;
    feedback: string;
  }[];
}

// Module with lessons for display
export interface ModuleWithLessons {
  id: string;
  slug: string;
  title: string;
  description: string;
  order: number;
  iconName: string | null;
  lessons: LessonSummary[];
}

// Lesson summary for list views
export interface LessonSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  order: number;
  technique: string;
  difficulty: LessonDifficulty;
  passingScore: number;
}

// Full lesson with content for lesson page
export interface LessonWithContent extends LessonSummary {
  moduleId: string;
  moduleSlug: string;
  moduleTitle: string;
  content: LessonContent;
}

// User's progress on a lesson
export interface UserProgress {
  lessonId: string;
  status: ProgressStatus;
  bestScore: number | null;
  attemptsCount: number;
  completedAt: Date | null;
}

// Progress status enum-like type
export type ProgressStatus = "locked" | "unlocked" | "in_progress" | "completed";

// Difficulty levels
export type LessonDifficulty = "beginner" | "intermediate" | "advanced";

// Evaluation result from Groq API
export interface EvaluationResult {
  overallScore: number;
  criteriaScores: {
    criterion: string;
    score: number;
    feedback: string;
  }[];
  strengths: string[];
  improvements: string[];
  revisedPromptSuggestion?: string;
  passed: boolean;
}

// Submit prompt request
export interface SubmitPromptRequest {
  lessonId: string;
  prompt: string;
}

// Submit prompt response
export interface SubmitPromptResponse {
  success: boolean;
  evaluation?: EvaluationResult;
  error?: string;
  nextLessonUnlocked?: boolean;
  nextLessonSlug?: string;
}

// User stats for dashboard
export interface UserStatsData {
  lessonsCompleted: number;
  totalLessons: number;
  currentStreak: number;
  longestStreak: number;
  totalAttempts: number;
  averageScore: number | null;
  lastActivityAt: Date | null;
}

// Module progress for dashboard
export interface ModuleProgress {
  moduleId: string;
  moduleSlug: string;
  moduleTitle: string;
  totalLessons: number;
  completedLessons: number;
  inProgressLessons: number;
  isUnlocked: boolean;
}

// Lesson with progress for lesson list
export interface LessonWithProgress extends LessonSummary {
  progress: UserProgress | null;
  isAccessible: boolean;
}

// Attempt history entry
export interface AttemptHistoryEntry {
  id: string;
  promptSubmitted: string;
  score: number;
  feedback: EvaluationFeedback | null;
  createdAt: Date;
}

// AI API response structure for evaluation
export interface AIEvaluationResponse {
  overallScore: number;
  criteriaScores: {
    criterion: string;
    score: number;
    feedback: string;
  }[];
  strengths: string[];
  improvements: string[];
  revisedPromptSuggestion?: string;
}

// Static lesson data (for curriculum content)
export interface StaticLesson {
  moduleSlug: string;
  slug: string;
  title: string;
  description: string;
  order: number;
  technique: string;
  difficulty: LessonDifficulty;
  passingScore: number;
  content: LessonContent;
}

// Static module data (for curriculum content)
export interface StaticModule {
  slug: string;
  title: string;
  description: string;
  order: number;
  iconName: string;
  lessons: Omit<StaticLesson, "moduleSlug">[];
}
