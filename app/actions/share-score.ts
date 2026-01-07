"use server";

import { adminDb } from "@/lib/instant-admin";
import { getUserFromInstantCookie } from "@instantdb/react/nextjs";
import { id } from "@instantdb/admin";

/**
 * Share score action for lessons and challenges
 *
 * SECURITY: User identity is verified server-side via getUserFromInstantCookie(),
 * NOT from client-provided userId. This prevents user impersonation attacks.
 */
export async function shareScoreAction(data: {
  shortId: string;
  type: "lesson" | "challenge";
  score: number;
  passed?: boolean;
  title: string;
  subtitle?: string;
}): Promise<{ success: boolean; error?: string }> {
  // Input validation with strict bounds
  if (typeof data.score !== "number" || data.score < 0 || data.score > 100) {
    return { success: false, error: "Invalid score value: must be 0-100" };
  }

  if (!data.shortId || typeof data.shortId !== "string" || data.shortId.length > 20) {
    return { success: false, error: "Invalid shortId" };
  }

  // Sanitize shortId to only allow alphanumeric characters, underscores, and dashes (nanoid format)
  // Prevents potential injection attacks via malicious shortId values
  const shortIdRegex = /^[a-zA-Z0-9_-]+$/;
  if (!shortIdRegex.test(data.shortId)) {
    return { success: false, error: "Invalid shortId: contains invalid characters" };
  }

  // Validate type
  if (data.type !== "lesson" && data.type !== "challenge") {
    return { success: false, error: "Invalid type: must be 'lesson' or 'challenge'" };
  }

  // Validate title
  if (!data.title || typeof data.title !== "string" || data.title.length === 0 || data.title.length > 200) {
    return { success: false, error: "Invalid title: must be 1-200 characters" };
  }

  // Validate subtitle if provided
  if (data.subtitle !== undefined && data.subtitle !== null) {
    if (typeof data.subtitle !== "string" || data.subtitle.length > 200) {
      return { success: false, error: "Invalid subtitle: must be 0-200 characters" };
    }
  }

  // Validate passed if provided
  if (data.passed !== undefined && typeof data.passed !== "boolean") {
    return { success: false, error: "Invalid passed value: must be boolean" };
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
        // User not authenticated - that's fine, score will be anonymous
        verifiedUserId = undefined;
      }
    }

    const sharedScoreId = id();

    // Create the shared score record
    const transactions = [
      adminDb.tx.sharedScores[sharedScoreId].update({
        shortId: data.shortId,
        type: data.type,
        score: Math.round(data.score),
        passed: data.passed ?? null,
        title: data.title.trim(),
        subtitle: data.subtitle?.trim() || null,
        createdAt: Date.now(),
      }),
    ];

    // Only link to user if we verified their identity server-side
    if (verifiedUserId) {
      transactions.push(
        adminDb.tx.sharedScores[sharedScoreId].link({
          user: verifiedUserId,
        })
      );
    }

    await adminDb.transact(transactions);

    return { success: true };
  } catch (error) {
    console.error("Error sharing score:", error);
    return { success: false, error: "Failed to share score" };
  }
}
