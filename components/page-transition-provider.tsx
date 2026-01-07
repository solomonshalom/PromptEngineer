"use client";

import { useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

interface PageTransitionProviderProps {
  children: React.ReactNode;
}

export function PageTransitionProvider({
  children,
}: PageTransitionProviderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isFirstRender = useRef(true);
  const previousPathname = useRef(pathname);

  // Initial fade-in on app mount
  useGSAP(
    () => {
      if (!containerRef.current) return;

      gsap.fromTo(
        containerRef.current,
        {
          opacity: 0,
        },
        {
          opacity: 1,
          duration: 0.6,
          ease: "power2.out",
        }
      );
    },
    { scope: containerRef }
  );

  // Handle route changes with fade-in
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Only animate if pathname actually changed
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname;

      if (!containerRef.current) return;

      // Reset opacity (in case TransitionLink faded it out)
      // Then animate in
      gsap.fromTo(
        containerRef.current,
        {
          opacity: 0,
          y: 8,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          ease: "power2.out",
          clearProps: "y",
        }
      );
    }
  }, [pathname]);

  return (
    <div ref={containerRef} data-page-transition className="min-h-screen">
      {children}
    </div>
  );
}
