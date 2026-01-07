"use client";

import { useRef } from "react";
import { Navigation } from "@/components/navigation";
import { allSections, curriculum } from "@/lib/lessons/content";
import { useLocalProgress } from "@/lib/use-local-progress";
import { db } from "@/lib/instant";
import { ChevronRight, GraduationCap } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { TransitionLink } from "@/components/transition-link";

gsap.registerPlugin(useGSAP);

export default function LearnPage() {
  const { isLoading: authLoading, user } = db.useAuth();
  const { stats, isLoaded, getProgressMap } = useLocalProgress();
  const progressMap = getProgressMap();

  const mainRef = useRef<HTMLDivElement>(null);
  const authGateRef = useRef<HTMLDivElement>(null);

  // Animate main content
  useGSAP(
    () => {
      if (mainRef.current) {
        // Animate sections with stagger
        const sections = mainRef.current.querySelectorAll("[data-section]");
        gsap.fromTo(
          sections,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.15,
            delay: 0.1,
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
    { dependencies: [user, isLoaded] }
  );

  // Calculate progress for each section
  const sectionsWithProgress = allSections.map((section) => {
    const modulesWithProgress = section.modules.map((module) => {
      let completedLessons = 0;

      module.lessons.forEach((lesson) => {
        const lessonId = `${module.slug}/${lesson.slug}`;
        const lessonProgress = progressMap.get(lessonId);
        if (lessonProgress?.status === "completed") {
          completedLessons++;
        }
      });

      return {
        ...module,
        completedLessons,
        totalLessons: module.lessons.length,
        progress: module.lessons.length > 0
          ? Math.round((completedLessons / module.lessons.length) * 100)
          : 0,
      };
    });

    const totalLessons = modulesWithProgress.reduce((sum, m) => sum + m.totalLessons, 0);
    const completedLessons = modulesWithProgress.reduce((sum, m) => sum + m.completedLessons, 0);

    return {
      ...section,
      modules: modulesWithProgress,
      totalLessons,
      completedLessons,
    };
  });

  // For backward compatibility - flat module list
  const modulesWithProgress = sectionsWithProgress.flatMap(s => s.modules);

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

  // Count total lessons and completed across all sections
  const totalLessons = curriculum.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedLessons = modulesWithProgress.reduce((sum, m) => sum + m.completedLessons, 0);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="flex flex-col items-center min-h-screen p-4 pt-20 pb-32">
        <div ref={mainRef} className="max-w-3xl w-full">
          {/* Overall progress - subtle, only if started */}
          {stats.totalAttempts > 0 && (
            <div data-section className="mb-12 text-small text-muted-foreground">
              {completedLessons} of {totalLessons} lessons completed
              {stats.averageScore && (
                <span className="ml-2">{`// ${stats.averageScore} avg score`}</span>
              )}
            </div>
          )}

          {/* Render each section */}
          {sectionsWithProgress.map((section, sectionIndex) => (
            <div
              key={section.id}
              data-section
              className={sectionIndex > 0 ? "mt-24" : ""}
            >
              {/* Section Header */}
              <div className="mb-12">
                <h1 className="text-large text-primary mb-4">
                  {section.title}
                </h1>
                <p className="text-base text-muted-foreground max-w-xl">
                  {section.description}
                </p>

                {/* Section progress - subtle, only if started */}
                {section.completedLessons > 0 && (
                  <div className="mt-4 text-small text-muted-foreground/60">
                    {section.completedLessons} of {section.totalLessons} lessons completed
                  </div>
                )}
              </div>

              {/* Modules - clean list, no cards */}
              <div className="space-y-1">
                {section.modules.map((module, index) => (
                  <TransitionLink
                    key={module.slug}
                    href={`/learn/${module.slug}`}
                    className="group flex items-center justify-between py-4 px-2 -mx-2 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-baseline gap-4">
                      <span className="text-small text-muted-foreground/60 w-6 tabular-nums">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <h2 className="text-base text-foreground group-hover:text-primary transition-colors">
                          {module.title}
                        </h2>
                        <p className="text-small text-muted-foreground mt-0.5">
                          {module.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Progress indicator */}
                      {module.completedLessons > 0 && (
                        <span className={`text-small ${module.progress === 100 ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {module.completedLessons}/{module.totalLessons}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </div>
                  </TransitionLink>
                ))}
              </div>
            </div>
          ))}

          {/* Subtle footer info */}
          <div data-section className="mt-20">
            <p className="text-small text-muted-foreground/60">
              {totalLessons} lessons across {curriculum.length} modules
            </p>
            <p className="text-small text-muted-foreground/40 mt-2">
              Progress synced to your account
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
