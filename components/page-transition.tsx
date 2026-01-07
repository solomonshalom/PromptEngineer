"use client";

import { useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isFirstRender = useRef(true);
  const previousPathname = useRef(pathname);

  // Initial fade-in animation on mount
  useGSAP(
    () => {
      if (!containerRef.current) return;

      // Initial page load - fade in
      gsap.fromTo(
        containerRef.current,
        {
          opacity: 0,
          y: 8,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: "power2.out",
        }
      );
    },
    { scope: containerRef }
  );

  // Handle route changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Only animate if the pathname actually changed
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname;

      if (!containerRef.current) return;

      // Quick fade in for route changes
      gsap.fromTo(
        containerRef.current,
        {
          opacity: 0,
          y: 6,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.35,
          ease: "power2.out",
        }
      );
    }
  }, [pathname]);

  return (
    <div ref={containerRef} className="min-h-screen">
      {children}
    </div>
  );
}

// Transition wrapper for content sections within a page
interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
}

export function FadeIn({
  children,
  delay = 0,
  duration = 0.5,
  className = "",
  direction = "up",
  distance = 20,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;

      const directionMap = {
        up: { y: distance, x: 0 },
        down: { y: -distance, x: 0 },
        left: { y: 0, x: distance },
        right: { y: 0, x: -distance },
        none: { y: 0, x: 0 },
      };

      const { x, y } = directionMap[direction];

      gsap.fromTo(
        ref.current,
        {
          opacity: 0,
          x,
          y,
        },
        {
          opacity: 1,
          x: 0,
          y: 0,
          duration,
          delay,
          ease: "power2.out",
        }
      );
    },
    { scope: ref }
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

// Stagger animation for lists
interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}

export function StaggerContainer({
  children,
  className = "",
  stagger = 0.08,
  delay = 0.1,
}: StaggerContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;

      const items = containerRef.current.children;

      gsap.fromTo(
        items,
        {
          opacity: 0,
          y: 15,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          stagger,
          delay,
          ease: "power2.out",
        }
      );
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}

// Hook for manual GSAP animations
export function usePageTransition() {
  const fadeOut = useCallback(
    (element: HTMLElement | null, onComplete?: () => void) => {
      if (!element) {
        onComplete?.();
        return;
      }

      gsap.to(element, {
        opacity: 0,
        y: -8,
        duration: 0.25,
        ease: "power2.in",
        onComplete,
      });
    },
    []
  );

  const fadeIn = useCallback(
    (element: HTMLElement | null, onComplete?: () => void) => {
      if (!element) {
        onComplete?.();
        return;
      }

      gsap.fromTo(
        element,
        {
          opacity: 0,
          y: 8,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.35,
          ease: "power2.out",
          onComplete,
        }
      );
    },
    []
  );

  const crossfade = useCallback(
    (
      outElement: HTMLElement | null,
      inElement: HTMLElement | null,
      onComplete?: () => void
    ) => {
      const tl = gsap.timeline({ onComplete });

      if (outElement) {
        tl.to(outElement, {
          opacity: 0,
          duration: 0.2,
          ease: "power2.in",
        });
      }

      if (inElement) {
        tl.fromTo(
          inElement,
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.3,
            ease: "power2.out",
          },
          outElement ? "-=0.1" : 0
        );
      }
    },
    []
  );

  return { fadeOut, fadeIn, crossfade };
}
