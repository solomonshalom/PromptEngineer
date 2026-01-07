"use client";

import { usePathname } from "next/navigation";
import { db } from "@/lib/instant";
import { GraduationCap, Keyboard, Lock } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { TransitionLink } from "./transition-link";

gsap.registerPlugin(useGSAP);

// Client name configured in InstantDB dashboard
const GOOGLE_CLIENT_NAME = "google-web";

// Generate DiceBear Dylan avatar URL (v9.x API)
function getDiceBearAvatar(seed: string): string {
  return `https://api.dicebear.com/9.x/dylan/svg?seed=${encodeURIComponent(seed)}`;
}

export function Navigation() {
  const { isLoading, user, error } = db.useAuth();
  const pathname = usePathname();
  const [showTooltip, setShowTooltip] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  // Determine if we're on a learn page
  const isLearnPage = pathname.startsWith("/learn");

  // Animate nav entrance on first load only
  useGSAP(
    () => {
      if (!navRef.current) return;

      // Set initial state
      gsap.set([leftRef.current, rightRef.current], { opacity: 0 });

      // Animate in
      const tl = gsap.timeline();

      tl.to(leftRef.current, {
        opacity: 1,
        duration: 0.4,
        ease: "power2.out",
      });

      tl.to(
        rightRef.current,
        {
          opacity: 1,
          duration: 0.4,
          ease: "power2.out",
        },
        "<"
      );
    },
    { scope: navRef }
  );

  const handleSignIn = () => {
    // Use InstantDB's redirect-based OAuth flow
    const url = db.auth.createAuthorizationURL({
      clientName: GOOGLE_CLIENT_NAME,
      redirectURL: window.location.href,
    });
    window.location.href = url;
  };

  // Log any auth errors
  useEffect(() => {
    if (error) {
      console.error("Auth error:", error);
    }
  }, [error]);

  return (
    <nav
      ref={navRef}
      className="fixed top-0 left-0 right-0 p-4 flex justify-between items-center z-50"
    >
      {/* Left side - context-aware navigation */}
      <div ref={leftRef}>
        {isLearnPage ? (
          <TransitionLink
            href="/"
            className="flex items-center gap-2 text-base text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Practice typing"
          >
            <Keyboard className="w-5 h-5" />
            <span className="hidden sm:inline">Practice</span>
          </TransitionLink>
        ) : user ? (
          <TransitionLink
            href="/learn"
            className="flex items-center gap-2 text-base text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Learn prompt engineering"
          >
            <GraduationCap className="w-5 h-5" />
            <span className="hidden sm:inline">Learn</span>
          </TransitionLink>
        ) : (
          <div
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <div
              className="flex items-center gap-2 text-base text-muted-foreground/40 cursor-not-allowed"
              aria-label="Sign in to access Learn"
            >
              <GraduationCap className="w-5 h-5" />
              <span className="hidden sm:inline">Learn</span>
              <Lock className="w-3 h-3" />
            </div>
            {showTooltip && (
              <div className="absolute left-0 top-full mt-2 px-3 py-2 bg-foreground text-background text-sm rounded-lg whitespace-nowrap shadow-lg animate-in fade-in zoom-in-95 duration-150">
                Sign in to access Learn
                <div className="absolute -top-1 left-4 w-2 h-2 bg-foreground rotate-45" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right side - Auth only (theme toggle removed) */}
      <div
        ref={rightRef}
        className={`flex items-center transition-opacity ${isLoading ? "opacity-0" : ""}`}
      >
        {user ? (
          <TransitionLink
            href="/profile"
            className="flex items-center hover:opacity-80 transition-opacity"
            title={user.email || "User"}
            aria-label={`View profile for ${user.email || "User"}`}
          >
            {/* DiceBear Dylan avatar - using img for external SVG */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getDiceBearAvatar(user.id || user.email || "default")}
              alt="Profile"
              className="w-9 h-9 rounded-full bg-muted"
            />
          </TransitionLink>
        ) : (
          <button
            onClick={handleSignIn}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-full transition-colors"
          >
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
}
