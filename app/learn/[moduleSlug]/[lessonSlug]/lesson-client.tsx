"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/navigation";
import { ChevronLeft, Lightbulb, Loader2, ArrowRight, RotateCcw, Volume2, VolumeX, Sparkles, RefreshCw, GraduationCap } from "lucide-react";
import { submitPromptAction, getAdaptiveScenarioAction, recordLessonAttemptAction } from "@/app/actions/learn";
import { useLocalProgress } from "@/lib/use-local-progress";
import { useKeyboardSounds } from "@/lib/use-keyboard-sounds";
import { db } from "@/lib/instant";
import type { LessonContent, EvaluationResult } from "@/lib/lessons/types";
import type { AdaptiveScenarioContent } from "@/lib/ai/generate-scenario";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { TransitionLink } from "@/components/transition-link";

gsap.registerPlugin(useGSAP);

interface LessonClientProps {
  lesson: {
    slug: string;
    title: string;
    description: string;
    technique: string;
    difficulty: string;
    passingScore: number;
    moduleSlug: string;
    moduleTitle: string;
    content: LessonContent;
  };
  moduleSlug: string;
  nextLesson: {
    moduleSlug: string;
    slug: string;
    title: string;
  } | null;
}

export function LessonClient({ lesson, moduleSlug, nextLesson }: LessonClientProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const evaluationRef = useRef<HTMLDivElement>(null);
  const authGateRef = useRef<HTMLDivElement>(null);
  const copyModalRef = useRef<HTMLDivElement>(null);
  const goodboyModalRef = useRef<HTMLDivElement>(null);
  const goodboyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auth for recording attempts and access control
  const { user, isLoading: authLoading } = db.useAuth();

  // State
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);

  // Copy-paste detection state
  const [showCopyWarning, setShowCopyWarning] = useState(false);
  const [showGoodboy, setShowGoodboy] = useState(false);

  // Adaptive scenario state
  const [adaptiveScenario, setAdaptiveScenario] = useState<AdaptiveScenarioContent | null>(null);
  const [isLoadingScenario, setIsLoadingScenario] = useState(false);
  const [useAdaptive, setUseAdaptive] = useState(false);

  // Keyboard sounds
  const { playPressSound, playReleaseSound, enabled: soundEnabled, toggleSound } = useKeyboardSounds({
    initialEnabled: true,
    volume: 0.9
  });

  // Local progress tracking
  const { isLoaded, getLessonProgress, recordAttempt, unlockLesson, progress } = useLocalProgress();
  const currentProgress = isLoaded ? getLessonProgress(moduleSlug, lesson.slug) : null;

  // GSAP animations
  useGSAP(
    () => {
      if (contentRef.current) {
        gsap.fromTo(
          contentRef.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }
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

  // Animate evaluation results when they appear
  useEffect(() => {
    if (evaluation && evaluationRef.current) {
      gsap.fromTo(
        evaluationRef.current,
        { opacity: 0, y: 30, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "power2.out" }
      );
    }
  }, [evaluation]);

  // Animate modals
  useEffect(() => {
    if (showCopyWarning && copyModalRef.current) {
      gsap.fromTo(
        copyModalRef.current,
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(1.7)" }
      );
    }
  }, [showCopyWarning]);

  useEffect(() => {
    if (showGoodboy && goodboyModalRef.current) {
      gsap.fromTo(
        goodboyModalRef.current,
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.7)" }
      );
    }
  }, [showGoodboy]);

  // Get recent scores for adaptive difficulty
  const getRecentScores = useCallback((): number[] => {
    const lessonId = `${moduleSlug}/${lesson.slug}`;
    const lessonProgress = progress.lessons[lessonId];
    if (lessonProgress?.bestScore) {
      return [lessonProgress.bestScore];
    }
    return [];
  }, [progress.lessons, moduleSlug, lesson.slug]);

  // Load adaptive scenario
  const loadAdaptiveScenario = useCallback(async (forceGenerate: boolean = false) => {
    setIsLoadingScenario(true);
    setError(null);

    try {
      const recentScores = getRecentScores();
      const result = await getAdaptiveScenarioAction(
        moduleSlug,
        lesson.slug,
        recentScores,
        forceGenerate
      );

      if (result.success && result.scenario) {
        setAdaptiveScenario(result.scenario);
        setUseAdaptive(true);
        setShowHints(false);
        setCurrentHintIndex(0);
      } else {
        setError(result.error || "Failed to load adaptive scenario");
      }
    } catch (err) {
      console.error("Error loading adaptive scenario:", err);
      setError("Failed to load adaptive scenario");
    } finally {
      setIsLoadingScenario(false);
    }
  }, [moduleSlug, lesson.slug, getRecentScores]);

  // Get current scenario (adaptive or base)
  const currentScenario = useAdaptive && adaptiveScenario
    ? adaptiveScenario.scenario
    : lesson.content.scenario;

  const currentHints = useAdaptive && adaptiveScenario
    ? adaptiveScenario.hints
    : lesson.content.hints;

  // Check if prompt is suspiciously similar to scenario or examples
  const detectCopyPaste = useCallback((text: string): boolean => {
    const normalizeText = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
    const userText = normalizeText(text);

    // Check against scenario
    const scenarioText = normalizeText(currentScenario);
    const similarity = (a: string, b: string) => {
      if (a.length < 20 || b.length < 20) return 0;
      // Check if one contains most of the other
      const shorter = a.length < b.length ? a : b;
      const longer = a.length < b.length ? b : a;
      if (longer.includes(shorter.slice(0, Math.min(50, shorter.length)))) return 0.9;
      // Check word overlap
      const wordsA = new Set(a.split(' ').filter(w => w.length > 3));
      const wordsB = new Set(b.split(' ').filter(w => w.length > 3));
      if (wordsA.size === 0 || wordsB.size === 0) return 0;
      const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
      return intersection / Math.min(wordsA.size, wordsB.size);
    };

    // Check against scenario
    if (similarity(userText, scenarioText) > 0.7) return true;

    // Check against good example
    const goodExampleText = normalizeText(lesson.content.goodExample.prompt);
    if (similarity(userText, goodExampleText) > 0.8) return true;

    // Check against bad example
    const badExampleText = normalizeText(lesson.content.badExample.prompt);
    if (similarity(userText, badExampleText) > 0.8) return true;

    return false;
  }, [currentScenario, lesson.content.goodExample.prompt, lesson.content.badExample.prompt]);

  // Auto-focus and auto-resize
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.max(120, textarea.scrollHeight)}px`;
    }
  }, [prompt]);

  const handleSubmit = async (bypassCopyCheck: boolean = false) => {
    if (prompt.trim().length === 0 || isSubmitting) return;

    // Check for copy-paste (unless bypassed)
    if (!bypassCopyCheck && detectCopyPaste(prompt)) {
      setShowCopyWarning(true);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await submitPromptAction(moduleSlug, lesson.slug, prompt);

      if (result.success && result.evaluation) {
        setEvaluation(result.evaluation);

        const passed = result.evaluation.overallScore >= lesson.passingScore;
        recordAttempt(moduleSlug, lesson.slug, result.evaluation.overallScore, passed, lesson.passingScore);

        // Record attempt to InstantDB (fire and forget for speed)
        recordLessonAttemptAction(
          moduleSlug,
          lesson.slug,
          result.evaluation.overallScore,
          passed,
          user?.id
        ).catch(console.error);

        if (passed && nextLesson) {
          unlockLesson(nextLesson.moduleSlug, nextLesson.slug);
        }
      } else {
        setError(result.error || "Failed to evaluate prompt");
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle "Yes, Sir" confirmation
  const handleCopyWarningConfirm = () => {
    setShowCopyWarning(false);
    setShowGoodboy(true);

    // Clear any existing timeout to prevent memory leaks
    if (goodboyTimeoutRef.current) {
      clearTimeout(goodboyTimeoutRef.current);
    }

    // After showing "Goodboy", proceed with submission
    goodboyTimeoutRef.current = setTimeout(() => {
      setShowGoodboy(false);
      handleSubmit(true); // Bypass copy check this time
    }, 1500);
  };

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (goodboyTimeoutRef.current) {
        clearTimeout(goodboyTimeoutRef.current);
      }
    };
  }, []);

  // Handle cancel copy warning
  const handleCopyWarningCancel = () => {
    setShowCopyWarning(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !isSubmitting && prompt.trim().length > 0) {
      e.preventDefault();
      handleSubmit();
      return;
    }

    // Play press sound
    if (!e.repeat && (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter" || e.key === "Tab")) {
      playPressSound(e.key);
    }
  };

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter" || e.key === "Tab") {
      playReleaseSound(e.key);
    }
  }, [playReleaseSound]);

  const handleRetry = () => {
    setEvaluation(null);
    setError(null);
    setPrompt("");
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleContinue = () => {
    if (nextLesson) {
      router.push(`/learn/${nextLesson.moduleSlug}/${nextLesson.slug}`);
    } else {
      router.push(`/learn/${moduleSlug}`);
    }
  };

  const handleShowNextHint = () => {
    if (!showHints) {
      setShowHints(true);
      setCurrentHintIndex(0);
    } else if (currentHintIndex < currentHints.length - 1) {
      setCurrentHintIndex(prev => prev + 1);
    }
  };

  // Switch back to base scenario
  const handleUseBaseScenario = () => {
    setUseAdaptive(false);
    setAdaptiveScenario(null);
    setShowHints(false);
    setCurrentHintIndex(0);
  };

  const passed = evaluation && evaluation.overallScore >= lesson.passingScore;

  // Auth loading state
  if (authLoading) {
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

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="flex flex-col items-center min-h-screen p-4 pt-20 pb-32">
        <div ref={contentRef} className="max-w-3xl w-full">
          {/* Back link */}
          <TransitionLink
            href={`/learn/${moduleSlug}`}
            className="inline-flex items-center gap-1 text-small text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ChevronLeft className="w-4 h-4" />
            {lesson.moduleTitle}
          </TransitionLink>

          {/* Header - minimal */}
          <div className="mb-12">
            <h1 className="text-large text-foreground mb-2">
              {lesson.title}
            </h1>
            <p className="text-small text-muted-foreground">
              {lesson.technique} · Pass score: {lesson.passingScore}
              {currentProgress?.bestScore !== null && currentProgress?.bestScore !== undefined && (
                <span className={currentProgress.bestScore >= lesson.passingScore ? 'text-green-500' : 'text-orange-500'}>
                  {` // Best: ${currentProgress.bestScore}`}
                </span>
              )}
            </p>
          </div>

          {/* Reference Material - Always visible, minimal design */}
          <div className="mb-12 space-y-8">
            {/* Introduction */}
            <p className="text-base text-foreground-2 leading-relaxed">
              {lesson.content.introduction}
            </p>

            {/* Key Principles */}
            {lesson.content.keyPrinciples.length > 0 && (
              <div>
                <h4 className="text-small text-muted-foreground mb-4">Key Principles</h4>
                <ul className="space-y-2">
                  {lesson.content.keyPrinciples.map((principle, index) => (
                    <li key={index} className="text-small text-foreground-2 flex items-start gap-2">
                      <span className="text-muted-foreground/40">·</span>
                      {principle}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Examples - Side by side */}
            <div className="grid gap-8 md:grid-cols-2">
              {/* Good Example */}
              <div>
                <h4 className="text-small text-green-600 dark:text-green-500 mb-3">Good Example</h4>
                <pre className="text-small text-foreground-2 whitespace-pre-wrap bg-muted/30 p-4 rounded-lg mb-3">
                  {lesson.content.goodExample.prompt}
                </pre>
                <p className="text-small text-muted-foreground">
                  {lesson.content.goodExample.explanation}
                </p>
              </div>

              {/* Bad Example */}
              <div>
                <h4 className="text-small text-orange-600 dark:text-orange-500 mb-3">Avoid This</h4>
                <pre className="text-small text-foreground-2 whitespace-pre-wrap bg-muted/30 p-4 rounded-lg mb-3">
                  {lesson.content.badExample.prompt}
                </pre>
                <p className="text-small text-muted-foreground">
                  {lesson.content.badExample.whyBad}
                </p>
              </div>
            </div>
          </div>

          {/* Subtle divider */}
          <div className="mb-8 border-t border-border/50" />

          {/* Main content area */}
          {!evaluation ? (
            <>
              {/* Challenge */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-small text-muted-foreground">Your Challenge</h2>
                    {useAdaptive && adaptiveScenario && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        adaptiveScenario.difficulty === "easier"
                          ? "bg-green-500/10 text-green-500"
                          : adaptiveScenario.difficulty === "harder"
                            ? "bg-orange-500/10 text-orange-500"
                            : "bg-blue-500/10 text-blue-500"
                      }`}>
                        {adaptiveScenario.difficulty === "easier" ? "Guided" :
                         adaptiveScenario.difficulty === "harder" ? "Advanced" : "Fresh"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {useAdaptive ? (
                      <>
                        <button
                          onClick={() => loadAdaptiveScenario(true)}
                          disabled={isLoadingScenario}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                          title="Generate new adaptive question"
                        >
                          {isLoadingScenario ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          New
                        </button>
                        <button
                          onClick={handleUseBaseScenario}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Original
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => loadAdaptiveScenario(false)}
                        disabled={isLoadingScenario}
                        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                        title="Get an AI-generated adaptive question"
                      >
                        {isLoadingScenario ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        Adaptive
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-medium text-foreground leading-relaxed">
                  {currentScenario}
                </p>
              </div>

              {/* Error display */}
              {error && (
                <div className="mb-6 p-4 text-orange-500 text-small">
                  {error}
                </div>
              )}

              {/* Prompt input - minimal, like typing game */}
              <div className="relative mb-6">
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyUp}
                  disabled={isSubmitting}
                  placeholder="Write your prompt here..."
                  className="w-full min-h-[120px] p-0 bg-transparent border-none resize-none focus:outline-none text-large text-foreground placeholder:text-muted-foreground/40 leading-relaxed scrollbar-none overflow-y-auto"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  aria-label="Write your prompt"
                />
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-muted-foreground/20 via-muted-foreground/10 to-transparent" />
              </div>

              {/* Hints */}
              {currentHints.length > 0 && (
                <div className="mb-8">
                  <button
                    onClick={handleShowNextHint}
                    className="flex items-center gap-2 text-small text-muted-foreground hover:text-foreground transition-colors"
                    disabled={showHints && currentHintIndex >= currentHints.length - 1}
                  >
                    <Lightbulb className="w-4 h-4" />
                    {!showHints
                      ? "Need a hint?"
                      : currentHintIndex < currentHints.length - 1
                        ? `Show hint ${currentHintIndex + 2} of ${currentHints.length}`
                        : "No more hints"
                    }
                  </button>

                  {showHints && (
                    <div className="mt-4 space-y-2">
                      {currentHints.slice(0, currentHintIndex + 1).map((hint, index) => (
                        <p
                          key={index}
                          className="text-small text-muted-foreground animate-in fade-in slide-in-from-top-2 duration-300"
                        >
                          {hint}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Action bar - minimal */}
              <div className="flex items-center justify-between">
                <div className="text-small text-muted-foreground/60">
                  {typeof navigator !== "undefined" && navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"} + Enter to submit
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleSubmit()}
                    disabled={prompt.trim().length === 0 || isSubmitting}
                    className={`text-base transition-colors ${
                      prompt.trim().length === 0 || isSubmitting
                        ? "text-muted-foreground/40 cursor-not-allowed"
                        : "text-primary hover:text-primary/80"
                    }`}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Evaluating
                      </span>
                    ) : (
                      "Submit"
                    )}
                  </button>
                </div>
              </div>

              {/* Evaluation criteria - subtle */}
              <div className="mt-12 pt-8 border-t border-border/30">
                <h4 className="text-small text-muted-foreground/60 mb-4">
                  Evaluation Criteria
                </h4>
                <p className="text-small text-muted-foreground">
                  {lesson.content.evaluationCriteria.map((criterion, index) => (
                    <span key={index}>
                      {criterion.criterion} ({criterion.weight}%)
                      {index < lesson.content.evaluationCriteria.length - 1 && ' // '}
                    </span>
                  ))}
                </p>
              </div>
            </>
          ) : (
            /* Feedback view */
            <div ref={evaluationRef}>
              {/* Score display - prominent but minimal */}
              <div className="text-center mb-12">
                <div className={`text-xxlarge tabular-nums ${passed ? 'text-green-500' : 'text-orange-500'}`}>
                  {evaluation.overallScore}
                </div>
                <p className={`text-small font-medium mt-1 ${
                  evaluation.overallScore >= 90 ? 'text-green-500' :
                  passed ? 'text-green-500/70' :
                  evaluation.overallScore >= 50 ? 'text-orange-500' :
                  'text-red-500'
                }`}>
                  {evaluation.overallScore >= 90 ? 'Excellent!' :
                   passed ? 'Good - Passed!' :
                   evaluation.overallScore >= 50 ? 'Needs Improvement' :
                   'Keep Practicing'}
                </p>
                <p className="text-base text-muted-foreground mt-2">
                  {passed
                    ? "Great job! You've demonstrated understanding of this technique."
                    : `Score ${lesson.passingScore}+ to pass`}
                </p>
              </div>

              {/* Criteria breakdown */}
              <div className="mb-12">
                <h4 className="text-small text-muted-foreground mb-4">Criteria Breakdown</h4>
                <div className="space-y-3">
                  {evaluation.criteriaScores.map((criterion, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-small text-foreground-2">{criterion.criterion}</span>
                      <span className={`text-small tabular-nums ${
                        criterion.score >= 70 ? 'text-green-500' : criterion.score >= 50 ? 'text-orange-500' : 'text-muted-foreground'
                      }`}>
                        {criterion.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feedback */}
              <div className="space-y-8 mb-12">
                {evaluation.strengths.length > 0 && (
                  <div>
                    <h4 className="text-small text-green-500/80 mb-3">Strengths</h4>
                    <ul className="space-y-2">
                      {evaluation.strengths.map((strength, index) => (
                        <li key={index} className="text-small text-foreground-2 flex items-start gap-2">
                          <span className="text-green-500/40">·</span>
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {evaluation.improvements.length > 0 && (
                  <div>
                    <h4 className="text-small text-orange-500/80 mb-3">Areas to Improve</h4>
                    <ul className="space-y-2">
                      {evaluation.improvements.map((improvement, index) => (
                        <li key={index} className="text-small text-foreground-2 flex items-start gap-2">
                          <span className="text-orange-500/40">·</span>
                          {improvement}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {evaluation.revisedPromptSuggestion && (
                  <div>
                    <h4 className="text-small text-muted-foreground mb-3">Suggested Prompt</h4>
                    <pre className="text-small text-foreground-2 whitespace-pre-wrap font-mono bg-muted/30 p-4 rounded-lg">
                      {evaluation.revisedPromptSuggestion}
                    </pre>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-center gap-8">
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-2 text-base text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try Again
                </button>

                {passed && nextLesson && (
                  <button
                    onClick={handleContinue}
                    className="flex items-center gap-2 text-base text-primary hover:text-primary/80 transition-colors"
                  >
                    Next Lesson
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Sound toggle - fixed bottom right like typing game */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleSound();
          setTimeout(() => textareaRef.current?.focus(), 0);
        }}
        className="fixed bottom-4 right-4 w-8 h-8 flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        aria-label={soundEnabled ? "Mute keyboard sounds" : "Unmute keyboard sounds"}
      >
        {soundEnabled ? (
          <Volume2 className="w-5 h-5" />
        ) : (
          <VolumeX className="w-5 h-5" />
        )}
      </button>

      {/* Dramatic Copy Warning Modal */}
      {showCopyWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div ref={copyModalRef} className="bg-background border border-border rounded-2xl p-8 max-w-md mx-4 text-center">
            <div className="text-xxlarge mb-4">🤨</div>
            <h2 className="text-large text-foreground mb-4">
              IS THIS REALLY WHAT YOU WANT, SON?
            </h2>
            <p className="text-base text-foreground-2 mb-2">
              REALLY?
            </p>
            <p className="text-base text-foreground-2 mb-8">
              ARE YOU SURE?
            </p>
            <p className="text-small text-muted-foreground mb-8">
              It looks like you copied the question or an example. The whole point is to practice writing your own prompts...
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleCopyWarningConfirm}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg text-base hover:bg-primary/90 transition-colors"
              >
                Yes, Sir
              </button>
              <button
                onClick={handleCopyWarningCancel}
                className="px-6 py-3 text-muted-foreground hover:text-foreground transition-colors text-small"
              >
                No, let me try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goodboy message */}
      {showGoodboy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div ref={goodboyModalRef} className="text-center">
            <div className="text-xxlarge mb-4">😏</div>
            <p className="text-xlarge text-white">
              Goodboy
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
