import { adminDb } from "@/lib/instant-admin";
import { NextResponse } from "next/server";

interface GameResultWithUser {
  id: string;
  wpm: number;
  accuracy: number;
  duration: number;
  createdAt: number;
  user?: Array<{
    id: string;
    email: string;
  }>;
}

export async function GET() {
  try {
    // Query for the single highest WPM result
    // Order by WPM descending and take just 1 result for efficiency
    const result = await adminDb.query({
      gameResults: {
        $: {
          order: { wpm: "desc" },
          limit: 1,
        },
        user: {},
      },
    });

    const gameResults = result.gameResults as GameResultWithUser[] | undefined;
    if (!gameResults || gameResults.length === 0) {
      return NextResponse.json({ wpm: 0, playerName: null });
    }

    const topResult = gameResults[0];
    return NextResponse.json({
      wpm: topResult.wpm,
      playerName: topResult.user?.[0]?.email?.split("@")[0] || null,
    });
  } catch (error) {
    console.error("Error fetching top player:", error);
    return NextResponse.json({ wpm: 0, playerName: null }, { status: 500 });
  }
}
