"use client";

import { ChallengeMode } from "@/components/challenge-mode";
import { Navigation } from "@/components/navigation";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <ChallengeMode />
    </div>
  );
}
