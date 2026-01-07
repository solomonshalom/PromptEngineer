import type { InstantRules } from "@instantdb/react";

/**
 * InstantDB Permissions for Typing Game
 *
 * Security model:
 * - Game results are publicly viewable (for leaderboard)
 * - Only authenticated users can create game results
 * - Users can only update/delete their own game results
 * - Shareable results are publicly viewable
 * - Anyone can create shareable results (including anonymous users)
 * - Adaptive scenarios are system-managed (created via server action)
 * - Lesson attempts are user-owned
 */

const rules = {
  $users: {
    allow: {
      // Users can view their own data
      view: "auth.id == data.id",
      // No direct create/update/delete by users
      create: "false",
      update: "false",
      delete: "false",
    },
  },
  gameResults: {
    allow: {
      // Anyone can view game results (needed for leaderboard)
      view: "true",
      // Anyone can create game results (including anonymous users)
      create: "true",
      // Users can only update their own game results
      update: "auth.id != null && auth.id == data.ref('user.id')",
      // Users can only delete their own game results
      delete: "auth.id != null && auth.id == data.ref('user.id')",
    },
  },
  shareableResults: {
    allow: {
      // Anyone can view shareable results
      view: "true",
      // Anyone can create shareable results
      create: "true",
      // No updates allowed
      update: "false",
      // Only the game result owner can delete
      delete: "auth.id != null && auth.id == data.ref('gameResult.user.id')",
    },
  },
  adaptiveScenarios: {
    allow: {
      // Anyone can view adaptive scenarios (they're public content)
      view: "true",
      // SECURITY: These rules appear permissive but InstantDB admin SDK
      // bypasses permission checks entirely. Client SDK operations still
      // need to pass validation. In practice, clients don't write to this
      // table - only server actions do. For extra security, we set to false
      // but admin SDK will still work (it bypasses rules).
      create: "false",
      update: "false",
      delete: "false",
    },
  },
  lessonAttempts: {
    allow: {
      // Users can only view their own attempts
      view: "auth.id != null && auth.id == data.ref('user.id')",
      // Created via server action
      create: "true",
      // No updates
      update: "false",
      // Users can delete their own attempts
      delete: "auth.id != null && auth.id == data.ref('user.id')",
    },
  },
  userProgress: {
    allow: {
      // Users can only view their own progress
      view: "auth.id != null && auth.id == data.ref('user.id')",
      // Authenticated users can create their progress record
      create: "auth.id != null",
      // Users can only update their own progress
      update: "auth.id != null && auth.id == data.ref('user.id')",
      // Users can delete their own progress
      delete: "auth.id != null && auth.id == data.ref('user.id')",
    },
  },
  generatedChallenges: {
    allow: {
      // Anyone can view generated challenges (they're public content)
      view: "true",
      // SECURITY: Block client-side writes. Admin SDK bypasses these rules,
      // so server actions can still create/update challenges.
      create: "false",
      update: "false",
      delete: "false",
    },
  },
  sharedScores: {
    allow: {
      // Anyone can view shared scores (needed for share links)
      view: "true",
      // Anyone can create shared scores (including anonymous users for sharing)
      create: "true",
      // No updates allowed - scores are immutable once shared
      update: "false",
      // Only the owner can delete their shared scores
      delete: "auth.id != null && auth.id == data.ref('user.id')",
    },
  },
} satisfies InstantRules;

export default rules;
