import { i } from "@instantdb/react";

/**
 * InstantDB Schema for Typing Game
 *
 * Entities:
 * - gameResults: Stores typing test results
 * - shareableResults: Stores shareable links for game results
 * - adaptiveScenarios: AI-generated adaptive scenarios for lessons
 * - lessonAttempts: User attempts on lessons for adaptive difficulty
 *
 * The $users entity is built-in and managed by InstantDB auth.
 */

// Type for adaptive scenario content
interface AdaptiveScenarioContent {
  scenario: string;
  targetBehavior: string;
  hints: string[];
  difficulty: "easier" | "standard" | "harder";
}

const _schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().unique().indexed(),
    }),
    gameResults: i.entity({
      wpm: i.number().indexed(), // Indexed for efficient leaderboard queries
      accuracy: i.number(),
      duration: i.number(),
      textExcerpt: i.string(),
      wpmHistory: i.json<Array<{ time: number; wpm: number }>>().optional(),
      createdAt: i.number().indexed(),
    }),
    shareableResults: i.entity({
      shortId: i.string().unique().indexed(),
      createdAt: i.number(),
    }),
    // AI-generated adaptive scenarios cached for performance
    adaptiveScenarios: i.entity({
      lessonId: i.string().indexed(), // e.g., "core-prompting/zero-shot-prompting"
      difficulty: i.string(), // "easier" | "standard" | "harder"
      content: i.json<AdaptiveScenarioContent>(),
      createdAt: i.number().indexed(),
      usageCount: i.number(), // Track how often this scenario is used
    }),
    // Track user lesson attempts for adaptive difficulty
    lessonAttempts: i.entity({
      lessonId: i.string().indexed(),
      score: i.number(),
      passed: i.boolean(),
      createdAt: i.number().indexed(),
    }),
    // User progress stats (XP, challenges, races)
    userProgress: i.entity({
      totalXP: i.number(),
      challengesCompleted: i.number(),
      racesWon: i.number(),
      recentChallengeScores: i.json<number[]>().optional(), // Last 5 scores for adaptive difficulty
      lastActivityAt: i.number().indexed(),
    }),
    // AI-generated challenges for the home page
    generatedChallenges: i.entity({
      technique: i.string().indexed(), // e.g., "Clear Instructions", "Few-Shot Prompting"
      difficulty: i.string().indexed(), // "easy" | "medium" | "hard"
      title: i.string(),
      scenario: i.string(),
      expectedLength: i.string(), // "short" | "medium" | "long"
      evaluationFocus: i.json<string[]>(),
      exampleGoodPrompt: i.string().optional(),
      createdAt: i.number().indexed(),
      usedCount: i.number(), // Track usage for rotation
      contentHash: i.string().unique().indexed(), // Prevent duplicates
    }),
  },
  links: {
    // User has many game results
    userGameResults: {
      forward: {
        on: "$users",
        has: "many",
        label: "gameResults",
      },
      reverse: {
        on: "gameResults",
        has: "one",
        label: "user",
      },
    },
    // Game result has one shareable result
    gameResultShareable: {
      forward: {
        on: "gameResults",
        has: "one",
        label: "shareableResult",
      },
      reverse: {
        on: "shareableResults",
        has: "one",
        label: "gameResult",
      },
    },
    // User has many lesson attempts
    userLessonAttempts: {
      forward: {
        on: "$users",
        has: "many",
        label: "lessonAttempts",
      },
      reverse: {
        on: "lessonAttempts",
        has: "one",
        label: "user",
      },
    },
    // User has one progress record
    userProgressLink: {
      forward: {
        on: "$users",
        has: "one",
        label: "progress",
      },
      reverse: {
        on: "userProgress",
        has: "one",
        label: "user",
      },
    },
  },
});

// Export schema for type inference
export type AppSchema = typeof _schema;
const schema: AppSchema = _schema;
export default schema;
