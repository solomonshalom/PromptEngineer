"use server";

import { adminDb } from "@/lib/instant-admin";
import { getUserFromInstantCookie } from "@instantdb/react/nextjs";
import { id } from "@instantdb/admin";

/**
 * Auto-save game result action
 *
 * Called automatically when a game finishes (for logged-in users).
 * This saves to profile/leaderboard WITHOUT creating a shareable link.
 *
 * SECURITY: User identity is verified server-side via getUserFromInstantCookie(),
 * NOT from client-provided userId. This prevents user impersonation attacks.
 */
export async function saveGameResult(data: {
  wpm: number;
  accuracy: number;
  duration: number;
  wpmHistory?: Array<{ time: number; wpm: number }>;
}): Promise<{ success: boolean; saved: boolean; gameResultId?: string }> {
  // Input validation with strict bounds
  if (typeof data.accuracy !== "number" || data.accuracy < 0 || data.accuracy > 100) {
    throw new Error("Invalid accuracy value: must be 0-100");
  }
  if (typeof data.wpm !== "number" || data.wpm < 0 || data.wpm > 350) {
    throw new Error("Invalid WPM value: must be 0-350");
  }
  if (typeof data.duration !== "number" || data.duration < 0 || data.duration > 300) {
    throw new Error("Invalid duration value: must be 0-300 seconds");
  }

  // Validate wpmHistory structure if provided
  if (data.wpmHistory !== undefined) {
    if (!Array.isArray(data.wpmHistory)) {
      throw new Error("Invalid wpmHistory: must be an array");
    }
    for (const entry of data.wpmHistory) {
      if (
        typeof entry !== "object" ||
        typeof entry.time !== "number" ||
        typeof entry.wpm !== "number" ||
        entry.time < 0 ||
        entry.wpm < 0
      ) {
        throw new Error("Invalid wpmHistory entry");
      }
    }
  }

  try {
    // SECURITY: Get user from server-side cookies, NOT from client
    const appId = process.env.NEXT_PUBLIC_INSTANT_APP_ID;

    if (!appId) {
      // No app ID configured - can't verify user
      return { success: true, saved: false };
    }

    let verifiedUserId: string | undefined;
    try {
      const user = await getUserFromInstantCookie(appId);
      verifiedUserId = user?.id;
    } catch {
      // User not authenticated - don't save (anonymous users don't get profile stats)
      return { success: true, saved: false };
    }

    // Only save if user is authenticated
    if (!verifiedUserId) {
      return { success: true, saved: false };
    }

    const gameResultId = id();

    // Create game result and link to user
    await adminDb.transact([
      adminDb.tx.gameResults[gameResultId].update({
        wpm: Math.round(data.wpm),
        accuracy: Math.round(data.accuracy),
        duration: Math.round(data.duration),
        textExcerpt: "",
        wpmHistory: data.wpmHistory || null,
        createdAt: Date.now(),
      }),
      adminDb.tx.gameResults[gameResultId].link({
        user: verifiedUserId,
      }),
    ]);

    return { success: true, saved: true, gameResultId };
  } catch (error) {
    console.error("Error saving game result:", error);
    // Don't throw - auto-save failures shouldn't break the game
    return { success: false, saved: false };
  }
}
