"use server";

import { adminDb } from "@/lib/instant-admin";
import { getUserFromInstantCookie } from "@instantdb/react/nextjs";
import { id } from "@instantdb/admin";

/**
 * Share game result action
 *
 * SECURITY: User identity is verified server-side via getUserOnServer(),
 * NOT from client-provided userId. This prevents user impersonation attacks.
 */
export async function shareGameResult(data: {
  shortId: string;
  wpm: number;
  accuracy: number;
  duration: number;
  wpmHistory?: Array<{ time: number; wpm: number }>;
  existingGameResultId?: string; // If provided, reuse this gameResult instead of creating a new one
}) {
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
  if (!data.shortId || typeof data.shortId !== "string" || data.shortId.length > 20) {
    throw new Error("Invalid shortId");
  }
  // Sanitize shortId to only allow alphanumeric characters and dashes (nanoid format)
  // Prevents potential injection attacks via malicious shortId values
  const shortIdRegex = /^[a-zA-Z0-9_-]+$/;
  if (!shortIdRegex.test(data.shortId)) {
    throw new Error("Invalid shortId: contains invalid characters");
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
    // This prevents user impersonation attacks
    const appId = process.env.NEXT_PUBLIC_INSTANT_APP_ID;
    let verifiedUserId: string | undefined;

    if (appId) {
      try {
        const user = await getUserFromInstantCookie(appId);
        verifiedUserId = user?.id;
      } catch {
        // User not authenticated - that's fine, game result will be anonymous
        verifiedUserId = undefined;
      }
    }

    const shareableResultId = id();

    // If we have an existing gameResultId (from auto-save), reuse it
    // Otherwise create a new gameResult (for anonymous users or when auto-save didn't run)
    const gameResultId = data.existingGameResultId || id();
    const shouldCreateGameResult = !data.existingGameResultId;

    // Build transactions
    const transactions = [];

    // Only create gameResult if we don't have an existing one
    if (shouldCreateGameResult) {
      transactions.push(
        adminDb.tx.gameResults[gameResultId].update({
          wpm: Math.round(data.wpm),
          accuracy: Math.round(data.accuracy),
          duration: Math.round(data.duration),
          textExcerpt: "",
          wpmHistory: data.wpmHistory || null,
          createdAt: Date.now(),
        })
      );

      // Link to user only for new gameResults (existing ones are already linked)
      if (verifiedUserId) {
        transactions.push(
          adminDb.tx.gameResults[gameResultId].link({
            user: verifiedUserId,
          })
        );
      }
    }

    // Always create shareableResult and link to gameResult
    transactions.push(
      adminDb.tx.shareableResults[shareableResultId].update({
        shortId: data.shortId,
        createdAt: Date.now(),
      }),
      adminDb.tx.shareableResults[shareableResultId].link({
        gameResult: gameResultId,
      })
    );

    await adminDb.transact(transactions);

    return { success: true };
  } catch (error) {
    console.error("Error sharing game result:", error);
    throw new Error("Failed to share game result");
  }
}
