"use server";

import { evaluatePrompt, RateLimitError } from "@/lib/ai/evaluate-prompt";
import { evaluateChallenge, generateLLMPrompt, type QuickEvaluationResult } from "@/lib/ai/evaluate-challenge";
import {
  generateAdaptiveScenario,
  calculateAdaptiveDifficulty,
  type AdaptiveScenarioContent,
  type DifficultyLevel,
} from "@/lib/ai/generate-scenario";
import { getLesson, getNextLesson } from "@/lib/lessons/content";
import { adminDb } from "@/lib/instant-admin";
import { id } from "@instantdb/admin";
import type { SubmitPromptResponse } from "@/lib/lessons/types";

export async function submitPromptAction(
  moduleSlug: string,
  lessonSlug: string,
  prompt: string
): Promise<SubmitPromptResponse> {
  // Validate input
  if (!prompt || typeof prompt !== "string") {
    return { success: false, error: "Please enter a prompt." };
  }

  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length === 0) {
    return { success: false, error: "Please enter a prompt." };
  }

  if (trimmedPrompt.length > 10000) {
    return { success: false, error: "Prompt is too long. Maximum 10,000 characters." };
  }

  // Get lesson content
  const lesson = getLesson(moduleSlug, lessonSlug);
  if (!lesson) {
    return { success: false, error: "Lesson not found." };
  }

  try {
    // Evaluate the prompt using Groq
    const evaluation = await evaluatePrompt({
      userPrompt: trimmedPrompt,
      lessonContent: lesson.content,
      lessonTitle: lesson.title,
      technique: lesson.technique,
    });

    // Check if there's a next lesson
    let nextLessonUnlocked = false;
    let nextLessonSlug: string | undefined;

    if (evaluation.passed) {
      const nextLesson = getNextLesson(moduleSlug, lessonSlug);
      if (nextLesson) {
        nextLessonUnlocked = true;
        nextLessonSlug = nextLesson.slug;
      }
    }

    return {
      success: true,
      evaluation,
      nextLessonUnlocked,
      nextLessonSlug,
    };
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        success: false,
        error: `Too many requests. Please wait ${error.retryAfterSeconds} seconds.`,
      };
    }

    console.error("Error evaluating prompt:", error);
    return {
      success: false,
      error: "Failed to evaluate prompt. Please try again.",
    };
  }
}

// Returns empty progress - all lessons accessible without DB
export async function getUserProgressAction(): Promise<Map<string, { status: string; bestScore: number | null }>> {
  return new Map();
}

// Returns null stats - no persistence without DB
export async function getUserStatsAction() {
  return null;
}

// No-op without DB
export async function initializeUserProgressAction() {
  // No database, nothing to initialize
}

// Challenge evaluation action
export interface ChallengeEvaluationResponse {
  success: boolean;
  evaluation?: QuickEvaluationResult;
  error?: string;
}

// Challenge data needed for evaluation (supports both static and generated)
export interface ChallengeForEvaluation {
  id: string;
  title: string;
  scenario: string;
  technique: string;
  difficulty: "easy" | "medium" | "hard";
  expectedLength: "short" | "medium" | "long";
  evaluationFocus: string[];
  exampleGoodPrompt?: string;
}

export async function submitChallengeAction(
  challenge: ChallengeForEvaluation,
  prompt: string
): Promise<ChallengeEvaluationResponse> {
  // Validate input
  if (!prompt || typeof prompt !== "string") {
    return { success: false, error: "Please enter a prompt." };
  }

  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length === 0) {
    return { success: false, error: "Please enter a prompt." };
  }

  if (trimmedPrompt.length > 5000) {
    return { success: false, error: "Prompt is too long. Maximum 5,000 characters." };
  }

  // Validate challenge object
  if (!challenge || !challenge.scenario || !challenge.technique) {
    return { success: false, error: "Invalid challenge." };
  }

  try {
    const evaluation = await evaluateChallenge(trimmedPrompt, challenge);
    return { success: true, evaluation };
  } catch (error) {
    console.error("Error evaluating challenge:", error);
    return { success: false, error: "Failed to evaluate. Please try again." };
  }
}

// Get LLM's prompt for race mode
export async function getLLMPromptAction(challenge: ChallengeForEvaluation): Promise<{ success: boolean; prompt?: string; error?: string }> {
  if (!challenge || !challenge.scenario) {
    return { success: false, error: "Invalid challenge." };
  }

  try {
    const prompt = await generateLLMPrompt(challenge);
    return { success: true, prompt };
  } catch (error) {
    console.error("Error generating LLM prompt:", error);
    return { success: false, error: "Failed to generate LLM prompt." };
  }
}

// ============================================
// ADAPTIVE SCENARIO GENERATION
// ============================================

export interface GetAdaptiveScenarioResponse {
  success: boolean;
  scenario?: AdaptiveScenarioContent;
  isGenerated?: boolean; // true if freshly generated, false if cached
  error?: string;
}

/**
 * Get an adaptive scenario for a lesson, generating one if needed
 * Scenarios are cached in InstantDB for performance
 */
export async function getAdaptiveScenarioAction(
  moduleSlug: string,
  lessonSlug: string,
  recentScores: number[] = [],
  forceGenerate: boolean = false
): Promise<GetAdaptiveScenarioResponse> {
  const lessonId = `${moduleSlug}/${lessonSlug}`;

  // Get lesson content
  const lesson = getLesson(moduleSlug, lessonSlug);
  if (!lesson) {
    return { success: false, error: "Lesson not found." };
  }

  // Calculate difficulty based on user performance
  const difficulty = calculateAdaptiveDifficulty(recentScores, lesson.passingScore);

  try {
    // Check for cached scenario if not forcing generation
    if (!forceGenerate) {
      const cached = await getCachedScenario(lessonId, difficulty);
      if (cached) {
        // Increment usage count async (fire and forget)
        incrementUsageCount(cached.id).catch(console.error);
        return {
          success: true,
          scenario: cached.content as AdaptiveScenarioContent,
          isGenerated: false,
        };
      }
    }

    // Get previously used scenarios to avoid repetition
    const previousScenarios = await getPreviousScenarios(lessonId, 3);

    // Generate new adaptive scenario
    const scenario = await generateAdaptiveScenario({
      lessonTitle: lesson.title,
      technique: lesson.technique,
      baseScenario: lesson.content.scenario,
      baseTargetBehavior: lesson.content.targetBehavior,
      baseHints: lesson.content.hints,
      keyPrinciples: lesson.content.keyPrinciples,
      goodExample: lesson.content.goodExample,
      difficulty,
      previousScenarios,
    });

    // Cache the generated scenario (fire and forget for speed)
    cacheScenario(lessonId, difficulty, scenario).catch(console.error);

    return {
      success: true,
      scenario,
      isGenerated: true,
    };
  } catch (error) {
    console.error("Error getting adaptive scenario:", error);

    // Fallback to base scenario
    return {
      success: true,
      scenario: {
        scenario: lesson.content.scenario,
        targetBehavior: lesson.content.targetBehavior,
        hints: lesson.content.hints,
        difficulty: "standard",
      },
      isGenerated: false,
    };
  }
}

/**
 * Get a cached scenario from InstantDB
 */
async function getCachedScenario(
  lessonId: string,
  difficulty: DifficultyLevel
): Promise<{ id: string; content: unknown } | null> {
  try {
    const result = await adminDb.query({
      adaptiveScenarios: {
        $: {
          where: {
            lessonId,
            difficulty,
          },
          order: { createdAt: "desc" },
          limit: 5, // Get a few to pick randomly
        },
      },
    });

    const scenarios = result.adaptiveScenarios;
    if (!scenarios || scenarios.length === 0) {
      return null;
    }

    // Pick a random cached scenario for variety
    const randomIndex = Math.floor(Math.random() * scenarios.length);
    const scenario = scenarios[randomIndex];

    return {
      id: scenario.id,
      content: scenario.content,
    };
  } catch (error) {
    console.error("Error fetching cached scenario:", error);
    return null;
  }
}

/**
 * Get previous scenarios to avoid repetition
 */
async function getPreviousScenarios(
  lessonId: string,
  limit: number
): Promise<string[]> {
  try {
    const result = await adminDb.query({
      adaptiveScenarios: {
        $: {
          where: { lessonId },
          order: { createdAt: "desc" },
          limit,
        },
      },
    });

    return (result.adaptiveScenarios || [])
      .map((s) => {
        const content = s.content as AdaptiveScenarioContent | null;
        return content?.scenario || "";
      })
      .filter(Boolean);
  } catch (error) {
    console.error("Error fetching previous scenarios:", error);
    return [];
  }
}

/**
 * Cache a generated scenario in InstantDB
 */
async function cacheScenario(
  lessonId: string,
  difficulty: DifficultyLevel,
  content: AdaptiveScenarioContent
): Promise<void> {
  try {
    const scenarioId = id();
    await adminDb.transact([
      adminDb.tx.adaptiveScenarios[scenarioId].update({
        lessonId,
        difficulty,
        content,
        createdAt: Date.now(),
        usageCount: 1,
      }),
    ]);
  } catch (error) {
    console.error("Error caching scenario:", error);
  }
}

/**
 * Increment the usage count for a cached scenario
 *
 * NOTE: Uses read-then-update pattern (no atomic increment in InstantDB).
 * This is acceptable for a non-critical usage counter.
 */
async function incrementUsageCount(scenarioId: string): Promise<void> {
  try {
    // Read current count first
    const result = await adminDb.query({
      adaptiveScenarios: {
        $: {
          where: { id: scenarioId },
          limit: 1,
        },
      },
    });

    const scenario = result.adaptiveScenarios?.[0];
    if (scenario) {
      const currentCount = (scenario.usageCount as number) || 0;
      await adminDb.transact([
        adminDb.tx.adaptiveScenarios[scenarioId].update({
          usageCount: currentCount + 1,
        }),
      ]);
    }
  } catch (error) {
    // Non-critical operation - log but don't propagate
    console.error("Error incrementing usage count:", error);
  }
}

/**
 * Record a lesson attempt (for adaptive difficulty calculation)
 */
export async function recordLessonAttemptAction(
  moduleSlug: string,
  lessonSlug: string,
  score: number,
  passed: boolean,
  userId?: string
): Promise<{ success: boolean }> {
  const lessonId = `${moduleSlug}/${lessonSlug}`;

  try {
    const attemptId = id();
    const transactions = [
      adminDb.tx.lessonAttempts[attemptId].update({
        lessonId,
        score,
        passed,
        createdAt: Date.now(),
      }),
    ];

    // Link to user if authenticated
    if (userId) {
      transactions.push(
        adminDb.tx.lessonAttempts[attemptId].link({
          user: userId,
        })
      );
    }

    await adminDb.transact(transactions);
    return { success: true };
  } catch (error) {
    console.error("Error recording lesson attempt:", error);
    return { success: false };
  }
}
