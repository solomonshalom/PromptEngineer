import { Navigation } from "@/components/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { LeaderboardContent } from "@/components/leaderboard-content";
import { adminDb } from "@/lib/instant-admin";

// Force dynamic rendering since we need environment variables and real-time data
export const dynamic = "force-dynamic";

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

async function getTopPlayers() {
  try {
    const result = await adminDb.query({
      gameResults: {
        $: {
          order: { createdAt: "desc" },
          limit: 100, // Fetch more to sort by WPM
        },
        user: {},
      },
    });

    if (!result.gameResults) {
      return [];
    }

    // Sort by WPM descending and take top 10
    const sortedResults = (result.gameResults as GameResultWithUser[])
      .sort((a, b) => b.wpm - a.wpm)
      .slice(0, 10);

    return sortedResults.map((r) => ({
      wpm: r.wpm,
      accuracy: r.accuracy,
      duration: r.duration,
      playerName: r.user?.[0]?.email?.split("@")[0] || null,
      createdAt: new Date(r.createdAt),
    }));
  } catch (error) {
    console.error("Error fetching top players:", error);
    return [];
  }
}

export default async function LeaderboardPage() {
  const topPlayers = await getTopPlayers();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <BottomNav />
      <div className="pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          <LeaderboardContent topPlayers={topPlayers} />
        </div>
      </div>
    </div>
  );
}
