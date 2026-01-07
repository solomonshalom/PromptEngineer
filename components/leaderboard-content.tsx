"use client";

import { useRef } from "react";
import { Trophy, Medal } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

interface Player {
  wpm: number;
  accuracy: number;
  duration: number;
  playerName: string | null;
  createdAt: Date;
}

interface LeaderboardContentProps {
  topPlayers: Player[];
}

export function LeaderboardContent({ topPlayers }: LeaderboardContentProps) {
  const headerRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const emptyRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Animate header
      if (headerRef.current) {
        gsap.fromTo(
          headerRef.current,
          { opacity: 0, x: -30 },
          { opacity: 1, x: 0, duration: 0.5, ease: "power2.out" }
        );
      }

      // Animate list items with stagger
      if (listRef.current) {
        const items = listRef.current.children;
        gsap.fromTo(
          items,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            stagger: 0.08,
            delay: 0.2,
            ease: "power2.out",
          }
        );
      }

      // Animate empty state
      if (emptyRef.current) {
        gsap.fromTo(
          emptyRef.current,
          { opacity: 0, scale: 0.95 },
          { opacity: 1, scale: 1, duration: 0.5, delay: 0.2, ease: "power2.out" }
        );
      }
    },
    { dependencies: [topPlayers] }
  );

  return (
    <>
      <h1
        ref={headerRef}
        className="text-large md:text-xlarge font-normal leading-none tracking-tighter mb-12"
      >
        <span className="text-orange-500">LEADERBOARD</span>
      </h1>

      {topPlayers.length === 0 ? (
        <div
          ref={emptyRef}
          className="text-center py-16 text-muted-foreground"
        >
          <p className="text-medium">
            No results yet. Be the first to set a record!
          </p>
        </div>
      ) : (
        <div ref={listRef} className="space-y-2">
          {topPlayers.map((player, index) => (
            <div
              key={index}
              className={`flex items-center gap-4 py-4 ${index < topPlayers.length - 1 ? "border-b border-border" : ""}`}
            >
              <div className="flex items-center justify-center w-12 h-12">
                {index === 0 ? (
                  <Trophy className="w-8 h-8 text-yellow-500" />
                ) : index === 1 ? (
                  <Medal className="w-8 h-8 text-gray-400" />
                ) : index === 2 ? (
                  <Medal className="w-8 h-8 text-amber-600" />
                ) : (
                  <span className="text-large font-bold text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                )}
              </div>

              <div className="flex-1">
                <div className="font-medium text-foreground">
                  {player.playerName || "Anonymous"}
                </div>
                <div className="text-small text-muted-foreground">
                  {player.accuracy}% accuracy &bull; {player.duration}s
                </div>
              </div>

              <div className="text-right flex items-center">
                <div className="text-large font-bold tabular-nums">
                  {player.wpm}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
