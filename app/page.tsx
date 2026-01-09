"use client";

import { useState, useRef, useEffect } from "react";
import { ChallengeMode } from "@/components/challenge-mode";
import { Navigation } from "@/components/navigation";
import { LandingOverlay } from "@/components/landing-overlay";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const LANDING_SEEN_KEY = "promptengineer_landing_seen";

export default function Home() {
  const [showLanding, setShowLanding] = useState<boolean | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  // Check localStorage on mount
  useEffect(() => {
    const hasSeenLanding = localStorage.getItem(LANDING_SEEN_KEY);
    setShowLanding(!hasSeenLanding);
  }, []);

  useGSAP(
    () => {
      if (showLanding === false && mainRef.current) {
        // Fade in main content when landing is dismissed
        gsap.fromTo(
          mainRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.5, ease: "power2.out" }
        );
      }
    },
    { dependencies: [showLanding] }
  );

  const handleGetStarted = () => {
    localStorage.setItem(LANDING_SEEN_KEY, "true");
    setShowLanding(false);
  };

  // Don't render until we've checked localStorage (prevents flash)
  if (showLanding === null) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background">
      {showLanding && <LandingOverlay onGetStarted={handleGetStarted} />}
      <div ref={mainRef} style={{ opacity: showLanding ? 0 : 1 }}>
        <Navigation />
        <ChallengeMode />
      </div>
    </div>
  );
}
