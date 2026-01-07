"use client";

import { useRef } from "react";
import { Keyboard, Trophy, LogOut } from "lucide-react";
import { db } from "@/lib/instant";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { TransitionLink } from "./transition-link";

gsap.registerPlugin(useGSAP);

export function BottomNav() {
  const { user } = db.useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  // Animate entrance from bottom on first load
  useGSAP(
    () => {
      if (!containerRef.current) return;

      const items = containerRef.current.children;

      // Set initial state
      gsap.set(items, { opacity: 0, y: 20, scale: 0.9 });

      // Animate in
      gsap.to(items, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.4,
        stagger: 0.08,
        delay: 0.3,
        ease: "back.out(1.7)",
      });
    },
    { scope: containerRef }
  );

  const handleSignOut = () => {
    db.auth.signOut();
  };

  return (
    <div
      ref={containerRef}
      className="fixed bottom-4 right-4 flex items-center gap-3"
    >
      {/* Sign out button - only shown when logged in */}
      {user && (
        <button
          onClick={handleSignOut}
          className="w-8 h-8 flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      )}

      {/* Leaderboard link */}
      <TransitionLink
        href="/leaderboard"
        className="w-8 h-8 flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        aria-label="View leaderboard"
        title="Leaderboard"
      >
        <Trophy className="w-5 h-5" />
      </TransitionLink>

      {/* Back to typing game */}
      <TransitionLink
        href="/"
        className="w-8 h-8 flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        aria-label="Back to typing game"
        title="Practice"
      >
        <Keyboard className="w-5 h-5" />
      </TransitionLink>
    </div>
  );
}

