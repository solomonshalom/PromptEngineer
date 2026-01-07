"use client";

import { useCallback, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import gsap from "gsap";

interface TransitionLinkProps
  extends Omit<React.ComponentProps<typeof Link>, "onClick"> {
  children: React.ReactNode;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}

// A Link component that triggers a fade-out before navigation
export function TransitionLink({
  href,
  children,
  onClick,
  ...props
}: TransitionLinkProps) {
  const router = useRouter();

  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      // Allow onClick to run first (e.g., for analytics)
      onClick?.(e);

      // If default was prevented by onClick, respect that
      if (e.defaultPrevented) return;

      // Don't intercept modified clicks (new tab, etc.)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      e.preventDefault();

      // Find the main content container
      const pageContainer = document.querySelector("[data-page-transition]");

      if (pageContainer) {
        gsap.to(pageContainer, {
          opacity: 0,
          y: -6,
          duration: 0.2,
          ease: "power2.in",
          onComplete: () => {
            router.push(href.toString());
          },
        });
      } else {
        // Fallback: navigate immediately if container not found
        router.push(href.toString());
      }
    },
    [href, router, onClick]
  );

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
