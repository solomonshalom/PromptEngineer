"use client";

import { useRef } from "react";
import { useParams } from "next/navigation";
import { Navigation } from "@/components/navigation";
import { getModule, curriculum } from "@/lib/lessons/content";
import { useLocalProgress } from "@/lib/use-local-progress";
import { db } from "@/lib/instant";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  GraduationCap,
} from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { TransitionLink } from "@/components/transition-link";

gsap.registerPlugin(useGSAP);

export default function ModulePage() {
  const params = useParams();
  const moduleSlug = params.moduleSlug as string;
  const currentModule = getModule(moduleSlug);
  const { isLoading: authLoading, user } = db.useAuth();
  const { isLoaded, getProgressMap } = useLocalProgress();
  const progressMap = getProgressMap();

  const mainRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const lessonsRef = useRef<HTMLDivElement>(null);
  const authGateRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (headerRef.current) {
        gsap.fromTo(
          headerRef.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }
        );
      }
      if (lessonsRef.current) {
        const items = lessonsRef.current.children;
        gsap.fromTo(
          items,
          { opacity: 0, y: 15 },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            stagger: 0.06,
            delay: 0.2,
            ease: "power2.out",
          }
        );
      }
      if (authGateRef.current) {
        gsap.fromTo(
          authGateRef.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }
        );
      }
    },
    { dependencies: [currentModule, user, isLoaded] }
  );

  // Show loading state
  if (authLoading || !isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Auth gate - show sign-in prompt for unauthenticated users
  if (!user) {
    const handleSignIn = () => {
      const url = db.auth.createAuthorizationURL({
        clientName: "google-web",
        redirectURL: window.location.href,
      });
      window.location.href = url;
    };

    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="flex flex-col items-center justify-center min-h-screen p-4">
          <div ref={authGateRef} className="max-w-md w-full text-center">
            <GraduationCap className="w-16 h-16 mx-auto mb-6 text-muted-foreground/40" />
            <h1 className="text-large text-foreground mb-4">
              Sign in to Learn
            </h1>
            <p className="text-base text-muted-foreground mb-8">
              Sign in with Google to access the prompt engineering curriculum and track your progress.
            </p>
            <button
              onClick={handleSignIn}
              className="px-6 py-3 text-base font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-full transition-colors"
            >
              Sign in with Google
            </button>
            <div className="mt-8">
              <TransitionLink
                href="/"
                className="text-small text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back to Practice
              </TransitionLink>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Handle not found
  if (!currentModule) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <h1 className="text-large text-foreground">Module not found</h1>
          <TransitionLink href="/learn" className="text-primary hover:underline">
            Back to modules
          </TransitionLink>
        </div>
      </div>
    );
  }

  // Calculate which lessons have progress
  const lessonsWithStatus = currentModule.lessons.map((lesson) => {
    const lessonId = `${moduleSlug}/${lesson.slug}`;
    const progress = progressMap.get(lessonId);

    return {
      ...lesson,
      status: progress?.status || null,
      bestScore: progress?.bestScore ?? null,
    };
  });

  // Find module navigation
  const currentIndex = curriculum.findIndex((m) => m.slug === moduleSlug);
  const prevModule = currentIndex > 0 ? curriculum[currentIndex - 1] : null;
  const nextModule = currentIndex < curriculum.length - 1 ? curriculum[currentIndex + 1] : null;

  // Count completed
  const completedCount = lessonsWithStatus.filter(l => l.status === "completed").length;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main ref={mainRef} className="flex flex-col items-center justify-center min-h-screen p-4 pt-20">
        <div className="max-w-3xl w-full">
          {/* Back link */}
          <TransitionLink
            href="/learn"
            className="inline-flex items-center gap-1 text-small text-muted-foreground hover:text-foreground transition-colors mb-12"
          >
            <ChevronLeft className="w-4 h-4" />
            All Modules
          </TransitionLink>

          {/* Header - minimal, centered */}
          <div ref={headerRef} className="text-center mb-16">
            <div className="text-small text-muted-foreground/60 mb-2">
              Module {currentModule.order}
            </div>
            <h1 className="text-large text-foreground mb-4">
              {currentModule.title}
            </h1>
            <p className="text-base text-muted-foreground max-w-xl mx-auto">
              {currentModule.description}
            </p>

            {/* Progress - subtle */}
            {completedCount > 0 && (
              <div className="mt-6 text-small text-muted-foreground">
                {completedCount} of {currentModule.lessons.length} completed
              </div>
            )}
          </div>

          {/* Lessons - clean list */}
          <div ref={lessonsRef} className="space-y-1">
            {lessonsWithStatus.map((lesson, index) => {
              const isCompleted = lesson.status === "completed";

              return (
                <TransitionLink
                  key={lesson.slug}
                  href={`/learn/${moduleSlug}/${lesson.slug}`}
                  className="group flex items-center justify-between py-4 px-2 -mx-2 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-baseline gap-4">
                    <span className="text-small text-muted-foreground/60 w-6 tabular-nums">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h2 className="text-base text-foreground group-hover:text-primary transition-colors">
                        {lesson.title}
                      </h2>
                      <p className="text-small text-muted-foreground mt-0.5">
                        {lesson.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Best score */}
                    {lesson.bestScore !== null && (
                      <span className={`text-small tabular-nums ${lesson.bestScore >= 70 ? 'text-green-500' : 'text-orange-500'}`}>
                        {lesson.bestScore}
                      </span>
                    )}

                    {/* Completion indicator */}
                    {isCompleted ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    )}
                  </div>
                </TransitionLink>
              );
            })}
          </div>

          {/* Module navigation */}
          <div className="flex items-center justify-between mt-16 pt-8 border-t border-border/50">
            {prevModule ? (
              <TransitionLink
                href={`/learn/${prevModule.slug}`}
                className="flex items-center gap-2 text-small text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                {prevModule.title}
              </TransitionLink>
            ) : (
              <div />
            )}

            {nextModule ? (
              <TransitionLink
                href={`/learn/${nextModule.slug}`}
                className="flex items-center gap-2 text-small text-muted-foreground hover:text-foreground transition-colors"
              >
                {nextModule.title}
                <ChevronRight className="w-4 h-4" />
              </TransitionLink>
            ) : (
              <div />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
