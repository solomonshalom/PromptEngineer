"use client";

import { useRef, useState, useEffect } from "react";
import { ArrowUpRight } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Howl } from "howler";

gsap.registerPlugin(useGSAP);

interface LandingOverlayProps {
  onGetStarted: () => void;
}

export function LandingOverlay({ onGetStarted }: LandingOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const subtextRef = useRef<HTMLParagraphElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popSoundRef = useRef<Howl | null>(null);
  const [isExiting, setIsExiting] = useState(false);

  // Initialize pop sound
  useEffect(() => {
    popSoundRef.current = new Howl({
      src: ["/sounds/press/SPACE.mp3"],
      volume: 0.8,
    });

    return () => {
      popSoundRef.current?.unload();
    };
  }, []);

  // Entry animation
  useGSAP(
    () => {
      const tl = gsap.timeline();

      // Set initial states
      gsap.set([headingRef.current, subtextRef.current, buttonRef.current], {
        opacity: 0,
        y: 30,
      });

      // Animate in sequence
      tl.to(headingRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: "power2.out",
      })
        .to(
          subtextRef.current,
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power2.out",
          },
          "-=0.3"
        )
        .to(
          buttonRef.current,
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power2.out",
          },
          "-=0.3"
        );
    },
    { scope: containerRef }
  );

  const handleClick = () => {
    if (isExiting) return;
    setIsExiting(true);

    // Play pop sound
    popSoundRef.current?.play();

    // Fade out animation
    gsap.to(containerRef.current, {
      opacity: 0,
      duration: 0.5,
      ease: "power2.inOut",
      onComplete: onGetStarted,
    });
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col items-start justify-center bg-white"
    >
      <div className="max-w-2xl px-12 text-left">
        {/* Orange heading - similar to "How LLMs Think & Behave" */}
        <h1
          ref={headingRef}
          className="text-large text-primary mb-6"
          style={{ opacity: 0 }}
        >
          Learn Prompt Engineering
        </h1>

        {/* Grey subtext - bigger and greyer */}
        <p
          ref={subtextRef}
          className="text-medium text-muted-foreground/80 mb-16 max-w-xl"
          style={{ opacity: 0 }}
        >
          By actually typing your prompts, getting the feedback and mastering
          the art
        </p>

        {/* Get Started button */}
        <button
          ref={buttonRef}
          onClick={handleClick}
          disabled={isExiting}
          className="group inline-flex items-center gap-2 px-8 py-4 text-base text-muted-foreground bg-muted hover:bg-muted/80 rounded-full transition-colors disabled:cursor-not-allowed"
          style={{ opacity: 0 }}
        >
          Get Started
          <ArrowUpRight className="w-5 h-5 transition-transform duration-200 group-hover:rotate-45" />
        </button>
      </div>
    </div>
  );
}
