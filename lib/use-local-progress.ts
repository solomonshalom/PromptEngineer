"use client";

import { useCallback, useMemo } from "react";
import { db } from "./instant";
import { id, tx } from "@instantdb/react";

export interface LessonProgress {
  status: "unlocked" | "in_progress" | "completed";
  bestScore: number | null;
  attemptsCount: number;
  completedAt: string | null;
}

export interface UserStats {
  lessonsCompleted: number;
  totalAttempts: number;
  averageScore: number | null;
  lastActivityAt: string | null;
  totalXP: number;
  challengesCompleted: number;
  racesWon: number;
}

// XP calculation constants
export const XP_REWARDS = {
  LESSON_BASE: 50,
  LESSON_SCORE_BONUS: 1,
  CHALLENGE_BASE: 25,
  CHALLENGE_SCORE_BONUS: 0.5,
  RACE_WIN: 100,
  FIRST_COMPLETION: 25,
};

const defaultStats: UserStats = {
  lessonsCompleted: 0,
  totalAttempts: 0,
  averageScore: null,
  lastActivityAt: null,
  totalXP: 0,
  challengesCompleted: 0,
  racesWon: 0,
};

/**
 * Hook for tracking user progress using InstantDB
 * For authenticated users: full persistence
 * For unauthenticated users: no persistence (stats show as 0)
 */
export function useLocalProgress() {
  // Get current user
  const { user, isLoading: authLoading } = db.useAuth();

  // Query user's lesson attempts (only if authenticated)
  const { data: attemptsData, isLoading: attemptsLoading } = db.useQuery(
    user
      ? {
          lessonAttempts: {
            $: {
              where: {
                "user.id": user.id,
              },
            },
          },
        }
      : null
  );

  // Query user's progress record (only if authenticated)
  const { data: progressData, isLoading: progressLoading } = db.useQuery(
    user
      ? {
          userProgress: {
            $: {
              where: {
                "user.id": user.id,
              },
            },
          },
        }
      : null
  );

  // Loading state considers auth state
  const isLoaded = !authLoading && (!user || (!attemptsLoading && !progressLoading));

  // Calculate lesson progress from attempts
  const lessonProgressMap = useMemo(() => {
    const map: Record<string, LessonProgress> = {};

    if (!attemptsData?.lessonAttempts) return map;

    // Group attempts by lesson ID
    const attemptsByLesson: Record<string, typeof attemptsData.lessonAttempts> = {};
    for (const attempt of attemptsData.lessonAttempts) {
      if (!attemptsByLesson[attempt.lessonId]) {
        attemptsByLesson[attempt.lessonId] = [];
      }
      attemptsByLesson[attempt.lessonId].push(attempt);
    }

    // Calculate progress for each lesson
    for (const [lessonId, attempts] of Object.entries(attemptsByLesson)) {
      // Skip if no attempts (shouldn't happen due to grouping, but defensive check)
      if (attempts.length === 0) continue;

      const sortedAttempts = [...attempts].sort((a, b) => b.createdAt - a.createdAt);
      // Math.max with spread returns -Infinity for empty array, so guard against it
      const scores = attempts.map((a) => a.score);
      const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
      const hasPassed = attempts.some((a) => a.passed);

      map[lessonId] = {
        status: hasPassed ? "completed" : "in_progress",
        bestScore,
        attemptsCount: attempts.length,
        completedAt: hasPassed
          ? new Date(sortedAttempts.find((a) => a.passed)?.createdAt || 0).toISOString()
          : null,
      };
    }

    return map;
  }, [attemptsData]);

  // Calculate user stats
  const stats: UserStats = useMemo(() => {
    if (!user) return defaultStats;

    const progress = progressData?.userProgress?.[0];
    const attempts = attemptsData?.lessonAttempts || [];

    // Calculate lessons completed (unique lessons with passed status)
    const passedLessonIds = new Set(
      attempts.filter((a) => a.passed).map((a) => a.lessonId)
    );
    const lessonsCompleted = passedLessonIds.size;

    // Calculate average score
    const totalAttempts = attempts.length;
    const averageScore =
      totalAttempts > 0
        ? Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / totalAttempts)
        : null;

    return {
      lessonsCompleted,
      totalAttempts,
      averageScore,
      lastActivityAt: progress?.lastActivityAt
        ? new Date(progress.lastActivityAt).toISOString()
        : null,
      totalXP: progress?.totalXP || 0,
      challengesCompleted: progress?.challengesCompleted || 0,
      racesWon: progress?.racesWon || 0,
    };
  }, [user, attemptsData, progressData]);

  // Get recent challenge scores for adaptive difficulty
  const recentChallengeScores: number[] = useMemo(() => {
    const progress = progressData?.userProgress?.[0];
    return (progress?.recentChallengeScores as number[]) || [];
  }, [progressData]);

  // Get progress for a specific lesson
  const getLessonProgress = useCallback(
    (moduleSlug: string, lessonSlug: string): LessonProgress | null => {
      const lessonId = `${moduleSlug}/${lessonSlug}`;
      return lessonProgressMap[lessonId] || null;
    },
    [lessonProgressMap]
  );

  // Check if a lesson is accessible (all lessons accessible for now)
  const isLessonAccessible = useCallback(
    (
      _moduleSlug: string,
      _lessonSlug: string,
      _lessonIndex: number,
      _previousLessonSlug?: string
    ): boolean => {
      // All lessons are accessible (no gating)
      return true;
    },
    []
  );

  // Record a lesson attempt
  const recordAttempt = useCallback(
    async (
      moduleSlug: string,
      lessonSlug: string,
      score: number,
      passed: boolean,
      passingScore: number = 70
    ) => {
      if (!user) return; // Only persist for authenticated users

      const lessonId = `${moduleSlug}/${lessonSlug}`;
      const now = Date.now();
      const attemptId = id();

      // Check if this is a new completion
      const currentProgress = lessonProgressMap[lessonId];
      const isNewCompletion = passed && currentProgress?.status !== "completed";

      // Calculate XP
      let xpEarned = 0;
      if (passed) {
        xpEarned = XP_REWARDS.LESSON_BASE;
        if (score > passingScore) {
          xpEarned += Math.floor((score - passingScore) * XP_REWARDS.LESSON_SCORE_BONUS);
        }
        if (isNewCompletion) {
          xpEarned += XP_REWARDS.FIRST_COMPLETION;
        }
      }

      // Get or create progress record
      const existingProgress = progressData?.userProgress?.[0];

      try {
        const transactions = [
          // Create lesson attempt
          tx.lessonAttempts[attemptId].update({
            lessonId,
            score,
            passed,
            createdAt: now,
          }),
          tx.lessonAttempts[attemptId].link({ user: user.id }),
        ];

        if (existingProgress) {
          // Update existing progress
          transactions.push(
            tx.userProgress[existingProgress.id].update({
              totalXP: (existingProgress.totalXP || 0) + xpEarned,
              lastActivityAt: now,
            })
          );
        } else {
          // Create new progress record
          const progressId = id();
          transactions.push(
            tx.userProgress[progressId].update({
              totalXP: xpEarned,
              challengesCompleted: 0,
              racesWon: 0,
              lastActivityAt: now,
            }),
            tx.userProgress[progressId].link({ user: user.id })
          );
        }

        await db.transact(transactions);
      } catch (error) {
        console.error("Error recording attempt:", error);
      }
    },
    [user, lessonProgressMap, progressData]
  );

  // Record a challenge completion
  const recordChallenge = useCallback(
    async (score: number, won: boolean = false) => {
      if (!user) return; // Only persist for authenticated users

      const now = Date.now();

      // Calculate XP
      let xpEarned = XP_REWARDS.CHALLENGE_BASE;
      xpEarned += Math.floor(score * XP_REWARDS.CHALLENGE_SCORE_BONUS);
      if (won) {
        xpEarned += XP_REWARDS.RACE_WIN;
      }

      const existingProgress = progressData?.userProgress?.[0];

      try {
        if (existingProgress) {
          // Update recent scores (keep last 5)
          const currentScores = (existingProgress.recentChallengeScores as number[]) || [];
          const newScores = [...currentScores, score].slice(-5);

          await db.transact([
            tx.userProgress[existingProgress.id].update({
              totalXP: (existingProgress.totalXP || 0) + xpEarned,
              challengesCompleted: (existingProgress.challengesCompleted || 0) + 1,
              racesWon: (existingProgress.racesWon || 0) + (won ? 1 : 0),
              recentChallengeScores: newScores,
              lastActivityAt: now,
            }),
          ]);
        } else {
          // Create new progress record
          const progressId = id();
          await db.transact([
            tx.userProgress[progressId].update({
              totalXP: xpEarned,
              challengesCompleted: 1,
              racesWon: won ? 1 : 0,
              recentChallengeScores: [score],
              lastActivityAt: now,
            }),
            tx.userProgress[progressId].link({ user: user.id }),
          ]);
        }
      } catch (error) {
        console.error("Error recording challenge:", error);
      }
    },
    [user, progressData]
  );

  // Add XP directly
  const addXP = useCallback(
    async (amount: number) => {
      if (!user) return;

      const existingProgress = progressData?.userProgress?.[0];
      const now = Date.now();

      try {
        if (existingProgress) {
          await db.transact([
            tx.userProgress[existingProgress.id].update({
              totalXP: (existingProgress.totalXP || 0) + amount,
              lastActivityAt: now,
            }),
          ]);
        } else {
          const progressId = id();
          await db.transact([
            tx.userProgress[progressId].update({
              totalXP: amount,
              challengesCompleted: 0,
              racesWon: 0,
              lastActivityAt: now,
            }),
            tx.userProgress[progressId].link({ user: user.id }),
          ]);
        }
      } catch (error) {
        console.error("Error adding XP:", error);
      }
    },
    [user, progressData]
  );

  // Unlock a lesson (no-op since all lessons are accessible)
  const unlockLesson = useCallback((_moduleSlug: string, _lessonSlug: string) => {
    // No-op - all lessons accessible
  }, []);

  // Calculate adaptive difficulty for challenges
  const getAdaptiveChallengeDifficulty = useCallback((): "easy" | "medium" | "hard" => {
    if (recentChallengeScores.length === 0) {
      return "easy";
    }

    const avgScore =
      recentChallengeScores.reduce((a, b) => a + b, 0) / recentChallengeScores.length;
    const passRate =
      recentChallengeScores.filter((s) => s >= 70).length / recentChallengeScores.length;

    if (avgScore < 50 || passRate < 0.33) {
      return "easy";
    }

    if (avgScore >= 80 && passRate >= 0.67) {
      return "hard";
    }

    return "medium";
  }, [recentChallengeScores]);

  // Get progress as a Map (for compatibility)
  const getProgressMap = useCallback((): Map<
    string,
    { status: string; bestScore: number | null }
  > => {
    const map = new Map<string, { status: string; bestScore: number | null }>();
    for (const [lessonId, progress] of Object.entries(lessonProgressMap)) {
      map.set(lessonId, {
        status: progress.status,
        bestScore: progress.bestScore,
      });
    }
    return map;
  }, [lessonProgressMap]);

  // Reset progress (no-op for now - would need to delete records)
  const resetProgress = useCallback(() => {
    console.warn("resetProgress not implemented for InstantDB");
  }, []);

  return {
    progress: { lessons: lessonProgressMap, stats, recentChallengeScores },
    stats,
    recentChallengeScores,
    isLoaded,
    getLessonProgress,
    isLessonAccessible,
    recordAttempt,
    recordChallenge,
    addXP,
    unlockLesson,
    getProgressMap,
    resetProgress,
    getAdaptiveChallengeDifficulty,
  };
}
