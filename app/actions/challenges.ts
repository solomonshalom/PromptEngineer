"use server";

import { adminDb } from "@/lib/instant-admin";
import { id } from "@instantdb/admin";
import {
  generateChallenge,
  createContentHash,
} from "@/lib/ai/generate-challenge";
import { challenges as staticChallenges, type Challenge } from "@/lib/challenges";

// Minimum pool size before triggering background generation
const MIN_POOL_SIZE = 5;
// How many to generate in background
const BACKGROUND_GEN_COUNT = 3;

export interface GetChallengeResponse {
  success: boolean;
  challenge?: Challenge;
  isGenerated?: boolean;
  error?: string;
}

/**
 * Get a challenge for the home page
 * Prefers generated challenges, falls back to static
 */
export async function getChallengeAction(
  difficulty: "easy" | "medium" | "hard"
): Promise<GetChallengeResponse> {
  try {
    // Try to get a generated challenge first
    const generated = await getGeneratedChallenge(difficulty);

    if (generated) {
      // Increment usage count async (fire and forget)
      incrementUsageCount(generated.id as string).catch(console.error);

      // Check pool size and trigger background generation if needed
      checkAndTriggerBackgroundGeneration(difficulty).catch(console.error);

      return {
        success: true,
        challenge: {
          id: generated.id as string,
          title: generated.title as string,
          scenario: generated.scenario as string,
          technique: generated.technique as string,
          difficulty: generated.difficulty as "easy" | "medium" | "hard",
          expectedLength: generated.expectedLength as "short" | "medium" | "long",
          evaluationFocus: generated.evaluationFocus as string[],
          exampleGoodPrompt: generated.exampleGoodPrompt as string | undefined,
        },
        isGenerated: true,
      };
    }

    // Fallback to static challenge
    const staticFiltered = staticChallenges.filter(c => c.difficulty === difficulty);
    const staticChallenge = staticFiltered[Math.floor(Math.random() * staticFiltered.length)];

    // Trigger background generation since we had to use static
    triggerBackgroundGeneration(difficulty, BACKGROUND_GEN_COUNT).catch(console.error);

    return {
      success: true,
      challenge: staticChallenge,
      isGenerated: false,
    };
  } catch (error) {
    console.error("Error getting challenge:", error);

    // Final fallback to any static challenge
    const staticFiltered = staticChallenges.filter(c => c.difficulty === difficulty);
    return {
      success: true,
      challenge: staticFiltered[Math.floor(Math.random() * staticFiltered.length)],
      isGenerated: false,
    };
  }
}

/**
 * Get a generated challenge from the database
 */
async function getGeneratedChallenge(
  difficulty: "easy" | "medium" | "hard"
): Promise<Record<string, unknown> | null> {
  try {
    const result = await adminDb.query({
      generatedChallenges: {
        $: {
          where: { difficulty },
          order: { usedCount: "asc", createdAt: "desc" }, // Prefer less-used, newer
          limit: 5,
        },
      },
    });

    const challenges = result.generatedChallenges;
    if (!challenges || challenges.length === 0) {
      return null;
    }

    // Pick randomly from top 5 least-used
    const randomIndex = Math.floor(Math.random() * challenges.length);
    return challenges[randomIndex] as Record<string, unknown>;
  } catch (error) {
    console.error("Error fetching generated challenge:", error);
    return null;
  }
}

/**
 * Increment usage count for a challenge
 *
 * NOTE: This uses a read-then-update pattern which has a race condition.
 * InstantDB doesn't support atomic increments natively. This is acceptable
 * because usedCount is only used for soft-rotation of challenges (least-used first)
 * and minor inconsistencies won't affect the user experience.
 */
async function incrementUsageCount(challengeId: string): Promise<void> {
  try {
    // Fetch current count first (race condition exists but is acceptable for this use case)
    const result = await adminDb.query({
      generatedChallenges: {
        $: {
          where: { id: challengeId },
          limit: 1,
        },
      },
    });

    const challenge = result.generatedChallenges?.[0];
    if (challenge) {
      const currentCount = (challenge.usedCount as number) || 0;
      await adminDb.transact([
        adminDb.tx.generatedChallenges[challengeId].update({
          usedCount: currentCount + 1,
        }),
      ]);
    }
  } catch (error) {
    // Non-critical operation - log but don't propagate error
    console.error("Error incrementing usage count:", error);
  }
}

/**
 * Check pool size and trigger generation if needed
 */
async function checkAndTriggerBackgroundGeneration(
  difficulty: "easy" | "medium" | "hard"
): Promise<void> {
  try {
    const result = await adminDb.query({
      generatedChallenges: {
        $: {
          where: { difficulty },
        },
      },
    });

    const count = result.generatedChallenges?.length || 0;

    if (count < MIN_POOL_SIZE) {
      await triggerBackgroundGeneration(difficulty, MIN_POOL_SIZE - count);
    }
  } catch (error) {
    console.error("Error checking pool size:", error);
  }
}

/**
 * Generate challenges in the background
 */
async function triggerBackgroundGeneration(
  difficulty: "easy" | "medium" | "hard",
  count: number
): Promise<void> {
  // Get existing scenarios to avoid duplicates
  const existingScenarios = await getExistingScenarios(difficulty);

  for (let i = 0; i < count; i++) {
    try {
      const generated = await generateChallenge({
        difficulty,
        previousScenarios: existingScenarios.slice(-5),
      });

      // Create content hash for deduplication
      const contentHash = createContentHash(generated.scenario);

      // Check if already exists
      const existing = await adminDb.query({
        generatedChallenges: {
          $: {
            where: { contentHash },
            limit: 1,
          },
        },
      });

      if (existing.generatedChallenges?.length === 0) {
        // Save to database
        const challengeId = id();
        await adminDb.transact([
          adminDb.tx.generatedChallenges[challengeId].update({
            technique: generated.technique,
            difficulty: generated.difficulty,
            title: generated.title,
            scenario: generated.scenario,
            expectedLength: generated.expectedLength,
            evaluationFocus: generated.evaluationFocus,
            exampleGoodPrompt: generated.exampleGoodPrompt,
            createdAt: Date.now(),
            usedCount: 0,
            contentHash,
          }),
        ]);

        existingScenarios.push(generated.scenario);
      }
    } catch (error) {
      console.error(`Background generation ${i + 1}/${count} failed:`, error);
    }
  }
}

/**
 * Get existing scenarios to avoid duplication
 */
async function getExistingScenarios(difficulty: "easy" | "medium" | "hard"): Promise<string[]> {
  try {
    const result = await adminDb.query({
      generatedChallenges: {
        $: {
          where: { difficulty },
          order: { createdAt: "desc" },
          limit: 10,
        },
      },
    });

    return (result.generatedChallenges || [])
      .map(c => c.scenario as string)
      .filter(Boolean);
  } catch (error) {
    console.error("Error fetching existing scenarios:", error);
    return [];
  }
}

/**
 * Manually trigger challenge generation (for seeding)
 */
export async function seedChallengesAction(
  count: number = 9 // 3 per difficulty
): Promise<{ success: boolean; generated: number; error?: string }> {
  let generated = 0;

  try {
    const difficulties: Array<"easy" | "medium" | "hard"> = ["easy", "medium", "hard"];
    const perDifficulty = Math.ceil(count / 3);

    for (const difficulty of difficulties) {
      await triggerBackgroundGeneration(difficulty, perDifficulty);
      generated += perDifficulty;
    }

    return { success: true, generated };
  } catch (error) {
    console.error("Error seeding challenges:", error);
    return { success: false, generated, error: "Failed to seed challenges" };
  }
}

/**
 * Get pool stats (for debugging/monitoring)
 */
export async function getChallengePoolStatsAction(): Promise<{
  easy: number;
  medium: number;
  hard: number;
  total: number;
}> {
  try {
    const result = await adminDb.query({
      generatedChallenges: {},
    });

    const challenges = result.generatedChallenges || [];

    return {
      easy: challenges.filter(c => c.difficulty === "easy").length,
      medium: challenges.filter(c => c.difficulty === "medium").length,
      hard: challenges.filter(c => c.difficulty === "hard").length,
      total: challenges.length,
    };
  } catch (error) {
    console.error("Error getting pool stats:", error);
    return { easy: 0, medium: 0, hard: 0, total: 0 };
  }
}
