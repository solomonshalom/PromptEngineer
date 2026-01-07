"use client";

import { db } from "@/lib/instant";
import { Navigation } from "@/components/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

interface GameResult {
  id: string;
  wpm: number;
  accuracy: number;
  duration: number;
  createdAt: number;
}

function StatsCard({ gameResults }: { gameResults: GameResult[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;

      const items = containerRef.current.children;
      gsap.fromTo(
        items,
        { opacity: 0, x: -40 },
        {
          opacity: 1,
          x: 0,
          duration: 0.6,
          stagger: 0.15,
          ease: "power2.out",
        }
      );
    },
    { scope: containerRef }
  );

  if (gameResults.length === 0) {
    return (
      <div ref={containerRef} className="flex flex-col items-start mb-16 gap-4">
        <div className="text-6xl md:text-[120px] font-normal leading-none tracking-tighter">
          <span className="text-orange-500">0</span>
          <span className="text-gray-500"> BEST</span>
        </div>
        <div className="text-6xl md:text-[120px] font-normal leading-none tracking-tighter">
          <span className="text-orange-500">0</span>
          <span className="text-gray-500"> AVG</span>
        </div>
      </div>
    );
  }

  const bestWpm = Math.max(...gameResults.map((r) => r.wpm));
  const averageWpm = Math.round(
    gameResults.reduce((sum, r) => sum + r.wpm, 0) / gameResults.length
  );

  return (
    <div ref={containerRef} className="flex flex-col items-start mb-16 gap-4">
      <div className="text-6xl md:text-[120px] font-normal leading-none tracking-tighter">
        <span className="text-orange-500">{bestWpm}</span>
        <span className="text-gray-500"> BEST</span>
      </div>
      <div className="text-6xl md:text-[120px] font-normal leading-none tracking-tighter">
        <span className="text-orange-500">{averageWpm}</span>
        <span className="text-gray-500"> AVG</span>
      </div>
    </div>
  );
}

function GameHistory({ gameResults }: { gameResults: GameResult[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const emptyRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (containerRef.current) {
        const items = containerRef.current.children;
        gsap.fromTo(
          items,
          { opacity: 0, y: 15 },
          {
            opacity: 1,
            y: 0,
            duration: 0.35,
            stagger: 0.05,
            delay: 0.4,
            ease: "power2.out",
          }
        );
      }
      if (emptyRef.current) {
        gsap.fromTo(
          emptyRef.current,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.5, delay: 0.3, ease: "power2.out" }
        );
      }
    },
    { dependencies: [gameResults] }
  );

  if (gameResults.length === 0) {
    return (
      <div
        ref={emptyRef}
        className="text-center py-12 text-gray-500 dark:text-gray-400"
      >
        No games played yet. Start typing to see your history!
      </div>
    );
  }

  // Sort by createdAt descending and limit to 20
  const sortedResults = [...gameResults]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20);

  return (
    <div ref={containerRef} className="space-y-3">
      {sortedResults.map((result) => (
        <div
          key={result.id}
          className="flex items-center justify-between py-0 text-lg"
        >
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="text-orange-500 tabular-nums text-right w-10">
                {result.wpm}
              </span>
              <span className="text-gray-500">WPM</span>
            </div>
            <span className="text-orange-500 tabular-nums text-right w-16">
              {result.accuracy}%
            </span>
          </div>
          <div className="text-gray-400">
            {new Date(result.createdAt).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { isLoading: authLoading, user } = db.useAuth();

  // Query user's game results
  const { isLoading: dataLoading, data } = db.useQuery(
    user
      ? {
          gameResults: {
            $: {
              where: {
                "user.id": user.id,
              },
            },
          },
        }
      : null
  );

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  // Show loading state
  if (authLoading || (user && dataLoading)) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <BottomNav />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  // If not authenticated, show nothing (will redirect)
  if (!user) {
    return null;
  }

  const gameResults = (data?.gameResults as GameResult[] | undefined) || [];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <BottomNav />
      <div className="max-w-4xl mx-auto p-8 pt-24">
        <StatsCard gameResults={gameResults} />
        <div className="mt-12">
          <GameHistory gameResults={gameResults} />
        </div>
      </div>
    </div>
  );
}
