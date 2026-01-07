"use client";

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { getChallengeByDifficulty, type Challenge } from "@/lib/challenges";
import { submitChallengeAction, getLLMPromptAction } from "@/app/actions/learn";
import { getChallengeAction } from "@/app/actions/challenges";
import { shareScoreAction } from "@/app/actions/share-score";
import { useLocalProgress, XP_REWARDS } from "@/lib/use-local-progress";
import { useKeyboardSounds } from "@/lib/use-keyboard-sounds";
import { Volume2, VolumeX, Flag, RotateCcw, Loader2, Medal, Zap, Sun, Moon, Timer, Share2 } from "lucide-react";
import { useTheme } from "next-themes";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { TransitionLink } from "./transition-link";
import { nanoid } from "nanoid";
import { toast } from "sonner";

gsap.registerPlugin(useGSAP);

interface ChallengeState {
  challenge: Challenge | null;
  userPrompt: string;
  isSubmitting: boolean;
  evaluation: { score: number; feedback: string; tip?: string } | null;
  error: string | null;
  xpEarned: number | null;
}

interface RaceState {
  enabled: boolean;
  llmPrompt: string | null;
  llmProgress: number; // Characters revealed by "AI"
  userFinished: boolean;
  llmFinished: boolean;
  raceStarted: boolean;
  startTime: number | null;
}

interface TypingMetrics {
  startTime: number | null;
  currentWPM: number;
  elapsedSeconds: number;
  isTyping: boolean;
}

export function ChallengeMode() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const llmTextRef = useRef<HTMLDivElement>(null);
  const llmIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const challengeRef = useRef<HTMLDivElement>(null);
  const evaluationRef = useRef<HTMLDivElement>(null);
  const xpDisplayRef = useRef<HTMLDivElement>(null);
  const copyModalRef = useRef<HTMLDivElement>(null);
  const goodboyModalRef = useRef<HTMLDivElement>(null);
  const goodboyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<ChallengeState>({
    challenge: null,
    userPrompt: "",
    isSubmitting: false,
    evaluation: null,
    error: null,
    xpEarned: null,
  });

  // Anti-cheat state
  const [showCopyWarning, setShowCopyWarning] = useState(false);
  const [showGoodboy, setShowGoodboy] = useState(false);

  // Share state
  const [isSharing, setIsSharing] = useState(false);

  const [race, setRace] = useState<RaceState>({
    enabled: false,
    llmPrompt: null,
    llmProgress: 0,
    userFinished: false,
    llmFinished: false,
    raceStarted: false,
    startTime: null,
  });

  // Typing metrics (like original typing-game)
  const [metricsEnabled, setMetricsEnabled] = useState(false);
  const [metricsVisible, setMetricsVisible] = useState(false); // Tracks if bar should be visible (stays true after first keystroke)
  const [metrics, setMetrics] = useState<TypingMetrics>({
    startTime: null,
    currentWPM: 0,
    elapsedSeconds: 0,
    isTyping: false,
  });
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Ghost cursor position for AI's typing
  const [ghostCursorPosition, setGhostCursorPosition] = useState<{ left: number | string; top: number }>({ left: 0, top: 0 });

  // Progress and XP tracking
  const { stats, recordChallenge, getAdaptiveChallengeDifficulty, isLoaded } = useLocalProgress();

  // Keyboard sounds
  const { playPressSound, playReleaseSound, enabled: soundEnabled, toggleSound } = useKeyboardSounds({
    initialEnabled: true,
    volume: 0.9,
  });

  // Theme toggle
  const { setTheme, resolvedTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);

  // Theme mount detection - intentional setState to avoid hydration mismatch
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setThemeMounted(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  // GSAP entrance animations
  useGSAP(
    () => {
      // XP display slides down
      if (xpDisplayRef.current) {
        gsap.fromTo(
          xpDisplayRef.current,
          { opacity: 0, y: -20 },
          { opacity: 1, y: 0, duration: 0.5, delay: 0.2, ease: "power2.out" }
        );
      }
    },
    { dependencies: [] }
  );

  // Animate challenge content when challenge changes
  useEffect(() => {
    if (state.challenge && challengeRef.current && !state.evaluation) {
      gsap.fromTo(
        challengeRef.current,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
      );
    }
  }, [state.challenge, state.evaluation]);

  // Animate evaluation results when they appear
  useEffect(() => {
    if (state.evaluation && evaluationRef.current) {
      gsap.fromTo(
        evaluationRef.current,
        { opacity: 0, y: 30, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "power2.out" }
      );
    }
  }, [state.evaluation]);

  // Animate copy warning modal
  useEffect(() => {
    if (showCopyWarning && copyModalRef.current) {
      gsap.fromTo(
        copyModalRef.current,
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(1.7)" }
      );
    }
  }, [showCopyWarning]);

  // Animate goodboy modal
  useEffect(() => {
    if (showGoodboy && goodboyModalRef.current) {
      gsap.fromTo(
        goodboyModalRef.current,
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.7)" }
      );
    }
  }, [showGoodboy]);

  // Detect copy-paste cheating
  const detectCopyPaste = useCallback((text: string): boolean => {
    if (!state.challenge) return false;

    const normalizeText = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
    const userText = normalizeText(text);

    // Helper to calculate similarity (word overlap)
    const calculateSimilarity = (a: string, b: string): number => {
      if (a.length < 15 || b.length < 15) return 0;
      const wordsA = new Set(a.split(' ').filter(w => w.length > 3));
      const wordsB = new Set(b.split(' ').filter(w => w.length > 3));
      if (wordsA.size === 0 || wordsB.size === 0) return 0;
      const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
      return intersection / Math.min(wordsA.size, wordsB.size);
    };

    // Check 1: Copy-pasted scenario
    const scenarioText = normalizeText(state.challenge.scenario);
    if (calculateSimilarity(userText, scenarioText) > 0.7) {
      return true;
    }

    // Check 2: Copy-pasted good example (if available)
    if (state.challenge.exampleGoodPrompt) {
      const goodExampleText = normalizeText(state.challenge.exampleGoodPrompt);
      if (calculateSimilarity(userText, goodExampleText) > 0.8) {
        return true;
      }
    }

    return false;
  }, [state.challenge]);

  // Initialize with static challenge INSTANTLY, then try to swap with generated
  // This ensures zero loading time - user sees a challenge immediately
  useEffect(() => {
    if (isLoaded) {
      const difficulty = getAdaptiveChallengeDifficulty();

      // Show static challenge INSTANTLY (no waiting)
      const staticChallenge = getChallengeByDifficulty(difficulty);
      setState(prev => ({ ...prev, challenge: staticChallenge }));
      textareaRef.current?.focus();

      // Try to fetch a generated challenge in background
      // Only swap if user hasn't started typing yet
      getChallengeAction(difficulty)
        .then(result => {
          if (result.success && result.challenge && result.isGenerated) {
            // Only swap if user hasn't typed anything yet
            setState(prev => {
              if (prev.userPrompt.length === 0 && !prev.isSubmitting && !prev.evaluation) {
                return { ...prev, challenge: result.challenge! };
              }
              return prev; // Keep current challenge if user started typing
            });
          }
        })
        .catch(() => {
          // Silent fail - we already have a static challenge showing
        });
    }
  }, [isLoaded, getAdaptiveChallengeDifficulty]);

  // Fetch LLM prompt when race mode is enabled
  useEffect(() => {
    if (race.enabled && state.challenge && !race.llmPrompt) {
      getLLMPromptAction(state.challenge).then(result => {
        if (result.success && result.prompt) {
          setRace(prev => ({ ...prev, llmPrompt: result.prompt || null }));
        }
      });
    }
  }, [race.enabled, state.challenge, race.llmPrompt]);

  // AI "typing" animation - reveal characters over time (like ghost cursor in original)
  useEffect(() => {
    if (race.enabled && race.raceStarted && race.llmPrompt && !race.llmFinished && race.startTime) {
      // AI types at ~60 WPM = 5 chars/sec
      const updateGhostProgress = () => {
        const elapsedMs = Date.now() - race.startTime!;
        const charsPerSecond = 5; // ~60 WPM
        const charactersTyped = Math.floor((elapsedMs / 1000) * charsPerSecond);

        setRace(prev => {
          if (charactersTyped >= (prev.llmPrompt?.length || 0)) {
            if (llmIntervalRef.current) clearInterval(llmIntervalRef.current);
            return { ...prev, llmProgress: prev.llmPrompt?.length || 0, llmFinished: true };
          }
          return { ...prev, llmProgress: charactersTyped };
        });
      };

      llmIntervalRef.current = setInterval(updateGhostProgress, 50);
      updateGhostProgress();

      return () => {
        if (llmIntervalRef.current) clearInterval(llmIntervalRef.current);
      };
    }
  }, [race.enabled, race.raceStarted, race.llmPrompt, race.llmFinished, race.startTime]);

  // Update ghost cursor position (same pattern as original typing-game.tsx)
  // useLayoutEffect is appropriate here because we're measuring DOM layout
  // and need to update synchronously to prevent visual flickering
  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    if (!llmTextRef.current || !race.enabled || !race.llmPrompt || !race.raceStarted) return;

    const container = llmTextRef.current;
    const spans = container.querySelectorAll('span[data-char]');

    if (spans.length === 0) return;

    const currentIndex = race.llmProgress;

    if (currentIndex === 0) {
      setGhostCursorPosition({ left: 0, top: 0 });
    } else if (currentIndex < spans.length) {
      const targetSpan = spans[currentIndex] as HTMLElement;
      const rect = targetSpan.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      setGhostCursorPosition({
        left: rect.left - containerRect.left,
        top: rect.top - containerRect.top,
      });
    } else {
      const lastSpan = spans[spans.length - 1] as HTMLElement;
      const rect = lastSpan.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      setGhostCursorPosition({
        left: rect.right - containerRect.left,
        top: rect.top - containerRect.top,
      });
    }
  }, [race.llmProgress, race.llmPrompt, race.enabled, race.raceStarted]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Calculate WPM continuously during typing (like original typing-game)
  useEffect(() => {
    if (metrics.isTyping && metrics.startTime) {
      const calculateMetrics = () => {
        const elapsedMs = Date.now() - metrics.startTime!;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const elapsedMinutes = elapsedMs / 60000;

        if (elapsedMinutes > 0) {
          // WPM = (characters / 5) / minutes
          const chars = state.userPrompt.length;
          const wpm = Math.min(Math.round((chars / 5) / elapsedMinutes), 999);
          setMetrics(prev => ({ ...prev, currentWPM: wpm, elapsedSeconds }));
        }
      };

      metricsIntervalRef.current = setInterval(calculateMetrics, 100);
      calculateMetrics();

      return () => {
        if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current);
      };
    }
  }, [metrics.isTyping, metrics.startTime, state.userPrompt]);

  // Start race when user starts typing
  const handlePromptChange = useCallback((value: string) => {
    setState(prev => ({ ...prev, userPrompt: value }));

    // Start typing metrics on first keystroke
    if (!metrics.isTyping && value.length === 1) {
      setMetrics(prev => ({ ...prev, isTyping: true, startTime: Date.now() }));
      // Show metrics bar (will stay visible until timer toggled off)
      if (metricsEnabled) {
        setMetricsVisible(true);
      }
    }

    // Start race on first keystroke
    if (race.enabled && !race.raceStarted && value.length === 1) {
      setRace(prev => ({ ...prev, raceStarted: true, startTime: Date.now() }));
    }
  }, [race.enabled, race.raceStarted, metrics.isTyping, metricsEnabled]);

  const handleSubmit = async (bypassCopyCheck: boolean = false) => {
    if (!state.challenge || state.userPrompt.trim().length === 0 || state.isSubmitting) return;

    // Check for copy-paste cheating (unless bypassing)
    if (!bypassCopyCheck && detectCopyPaste(state.userPrompt)) {
      setShowCopyWarning(true);
      return;
    }

    // Stop AI's typing if still going
    if (llmIntervalRef.current) clearInterval(llmIntervalRef.current);

    setState(prev => ({ ...prev, isSubmitting: true, error: null }));
    setRace(prev => ({ ...prev, userFinished: true }));

    try {
      const result = await submitChallengeAction(state.challenge, state.userPrompt);

      if (result.success && result.evaluation) {
        // Determine if user won the race (finished before AI)
        const won = race.enabled && !race.llmFinished;

        // Calculate XP
        let xp = XP_REWARDS.CHALLENGE_BASE;
        xp += Math.floor(result.evaluation.score * XP_REWARDS.CHALLENGE_SCORE_BONUS);
        if (won) xp += XP_REWARDS.RACE_WIN;

        // Record to localStorage
        recordChallenge(result.evaluation.score, won);

        setState(prev => ({
          ...prev,
          isSubmitting: false,
          evaluation: result.evaluation || null,
          xpEarned: xp,
        }));
      } else {
        setState(prev => ({
          ...prev,
          isSubmitting: false,
          error: result.error || "Failed to evaluate",
        }));
      }
    } catch {
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        error: "An error occurred. Please try again.",
      }));
    }
  };

  // Handle copy warning confirmation ("Yes, Sir" clicked)
  const handleCopyWarningConfirm = () => {
    setShowCopyWarning(false);
    setShowGoodboy(true);

    // Clear any existing timeout to prevent memory leaks
    if (goodboyTimeoutRef.current) {
      clearTimeout(goodboyTimeoutRef.current);
    }

    // Show "Goodboy" for 1.5 seconds, then submit
    goodboyTimeoutRef.current = setTimeout(() => {
      setShowGoodboy(false);
      handleSubmit(true); // Bypass copy check since they confirmed
    }, 1500);
  };

  // Cleanup timeouts on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (goodboyTimeoutRef.current) {
        clearTimeout(goodboyTimeoutRef.current);
      }
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Restart on Escape (like original typing-game)
    if (e.key === "Escape") {
      e.preventDefault();
      handleNextChallenge();
      return;
    }

    // Submit on Enter (without shift)
    if (e.key === "Enter" && !e.shiftKey && !state.isSubmitting && state.userPrompt.trim().length > 0 && !showCopyWarning && !showGoodboy) {
      e.preventDefault();
      handleSubmit(false);
      return;
    }

    // Play press sound
    if (!e.repeat && (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter")) {
      playPressSound(e.key);
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter") {
      playReleaseSound(e.key);
    }
  };

  const handleShare = async () => {
    if (!state.challenge || !state.evaluation || isSharing) return;

    setIsSharing(true);
    const shortId = nanoid(8);
    const shareUrl = `${window.location.origin}/score/${shortId}`;

    // Optimistically copy to clipboard and show success
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard!");
    } catch {
      // Fallback for browsers without clipboard API or denied permissions
      toast.error("Failed to copy link - please copy manually");
      console.error("Clipboard API not available or permission denied");
      setIsSharing(false);
      return;
    }

    // Save to database in the background
    try {
      const result = await shareScoreAction({
        shortId,
        type: "challenge",
        score: state.evaluation.score,
        passed: state.evaluation.score >= 70,
        title: state.challenge.technique,
        subtitle: state.challenge.difficulty,
      });

      if (!result.success) {
        console.error("Failed to save share:", result.error);
        // Don't show error toast since link was already copied
      }
    } catch (err) {
      console.error("Error saving share:", err);
      // Don't show error toast since link was already copied
    } finally {
      setIsSharing(false);
    }
  };

  const handleNextChallenge = () => {
    // Get adaptive difficulty based on recent performance
    const difficulty = getAdaptiveChallengeDifficulty();

    // Clear metrics interval
    if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current);

    // Show static challenge INSTANTLY (no loading spinner)
    const staticChallenge = getChallengeByDifficulty(difficulty);
    setState({
      challenge: staticChallenge,
      userPrompt: "",
      isSubmitting: false,
      evaluation: null,
      error: null,
      xpEarned: null,
    });

    // Try to swap with generated challenge in background (if user hasn't typed)
    getChallengeAction(difficulty)
      .then(result => {
        if (result.success && result.challenge && result.isGenerated) {
          setState(prev => {
            // Only swap if user hasn't started typing
            if (prev.userPrompt.length === 0 && !prev.isSubmitting && !prev.evaluation) {
              return { ...prev, challenge: result.challenge! };
            }
            return prev;
          });
        }
      })
      .catch(() => {
        // Silent fail - static challenge is already showing
      });
    setRace(prev => ({
      ...prev,
      llmPrompt: null,
      llmProgress: 0,
      userFinished: false,
      llmFinished: false,
      raceStarted: false,
      startTime: null,
    }));
    // Reset typing metrics (like original typing-game)
    setMetrics({
      startTime: null,
      currentWPM: 0,
      elapsedSeconds: 0,
      isTyping: false,
    });
    setGhostCursorPosition({ left: 0, top: 0 });
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleClick = () => {
    textareaRef.current?.focus();
  };

  if (!state.challenge) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4" onClick={handleClick}>
      <div className="max-w-4xl w-full">
        {/* Challenge display */}
        {!state.evaluation ? (
          <div ref={challengeRef}>
            {/* Challenge title and technique */}
            <div className="mb-4 text-small text-muted-foreground">
              {state.challenge.technique}
              <span className="mx-2">·</span>
              <span className={
                state.challenge.difficulty === "easy" ? "text-green-500" :
                state.challenge.difficulty === "medium" ? "text-orange-500" : "text-red-500"
              }>
                {state.challenge.difficulty}
              </span>
            </div>

            {/* Scenario */}
            <div className="text-large leading-relaxed mb-8">
              {state.challenge.scenario}
            </div>

            {/* Prompt input */}
            <div className="relative mb-6">
              <textarea
                ref={textareaRef}
                value={state.userPrompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
                disabled={state.isSubmitting}
                placeholder="Write your prompt..."
                className="w-full min-h-[100px] p-0 bg-transparent border-none resize-none focus:outline-none text-large text-foreground placeholder:text-muted-foreground/40 leading-relaxed scrollbar-none"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                aria-label="Write your prompt"
              />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-muted-foreground/20 via-muted-foreground/10 to-transparent" />
            </div>

            {/* Ghost cursor race mode - AI's prompt being typed (EXACT same pattern as original) */}
            {race.enabled && race.llmPrompt && race.raceStarted && !state.evaluation && (
              <div className="mb-8 relative">
                <div className="text-small text-muted-foreground mb-2">AI is writing...</div>
                <div
                  ref={llmTextRef}
                  className="text-base leading-relaxed break-words font-mono relative"
                >
                  {race.llmPrompt.split("").map((char, index) => {
                    // Same styling pattern as original typing-game.tsx
                    const isTyped = index < race.llmProgress;
                    const className = isTyped ? "text-purple-500/70" : "text-muted-foreground/20";

                    return (
                      <span key={index} data-char className={className}>
                        {char}
                      </span>
                    );
                  })}

                  {/* Ghost cursor (EXACT same as original typing-game.tsx) */}
                  {!race.llmFinished && (
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        left: `${ghostCursorPosition.left}px`,
                        top: `${ghostCursorPosition.top}px`,
                        transition: 'left 0.15s ease-out, top 0.15s ease-out',
                      }}
                    >
                      {/* Player name label above cursor (EXACT same as original) */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1">
                        <div className="bg-purple-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap">
                          AI
                        </div>
                      </div>
                      {/* Purple cursor line (EXACT same as original) */}
                      <div className="w-[3px] h-6 bg-purple-500" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {state.error && (
              <p className="mt-4 text-orange-500 text-small">{state.error}</p>
            )}

            {/* Metrics bar - fades in on first keystroke, stays visible until timer toggled off */}
            {metricsEnabled && (
              <div className={`flex flex-col md:flex-row items-center justify-end gap-6 mt-8 text-large w-full transition-opacity duration-300 ${metricsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                {state.isSubmitting ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </span>
                ) : (
                  <span className="text-muted-foreground tabular-nums">{metrics.elapsedSeconds}s</span>
                )}
                <span className="text-muted-foreground tabular-nums w-36 text-right">
                  {metrics.currentWPM} WPM
                </span>
                <button
                  onClick={handleNextChallenge}
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors bg-transparent border-none p-0"
                  aria-label="New challenge"
                >
                  Restart
                </button>
              </div>
            )}

            {/* Submit hint - fades out when timer is ON */}
            <div className={`mt-6 text-center transition-opacity duration-300 ${metricsEnabled ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <span className="text-small text-muted-foreground/60">
                Press Enter to submit · Esc to restart
              </span>
            </div>
          </div>
        ) : (
          /* Evaluation results */
          <div ref={evaluationRef}>
            {/* Score */}
            <div className="text-center mb-8">
              <div className={`text-xxlarge tabular-nums ${state.evaluation.score >= 70 ? 'text-green-500' : 'text-orange-500'}`}>
                {state.evaluation.score}
              </div>
              <p className={`text-small font-medium mt-1 ${
                state.evaluation.score >= 90 ? 'text-green-500' :
                state.evaluation.score >= 70 ? 'text-green-500/70' :
                state.evaluation.score >= 50 ? 'text-orange-500' :
                'text-red-500'
              }`}>
                {state.evaluation.score >= 90 ? 'Excellent!' :
                 state.evaluation.score >= 70 ? 'Good - Passed!' :
                 state.evaluation.score >= 50 ? 'Needs Improvement' :
                 'Keep Practicing'}
              </p>
              <p className="text-base text-muted-foreground mt-2">{state.evaluation.feedback}</p>
              {state.evaluation.tip && (
                <p className="text-small text-muted-foreground/60 mt-2">{state.evaluation.tip}</p>
              )}
            </div>

            {/* XP earned */}
            {state.xpEarned !== null && (
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 rounded-full">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="text-base text-yellow-500">+{state.xpEarned} XP</span>
                  {race.enabled && !race.llmFinished && race.userFinished && (
                    <span className="text-small text-purple-500 ml-2">Race won!</span>
                  )}
                </div>
              </div>
            )}

            {/* AI's full prompt (in race mode) */}
            {race.enabled && race.llmPrompt && (
              <div className="mb-8">
                <p className="text-small text-muted-foreground mb-2">AI&apos;s prompt:</p>
                <pre className="text-small text-foreground/70 whitespace-pre-wrap font-mono bg-muted/30 p-4 rounded-lg">
                  {race.llmPrompt}
                </pre>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-center gap-8">
              <button
                onClick={handleShare}
                disabled={isSharing}
                className="flex items-center gap-2 text-base text-orange-500 hover:text-orange-600 transition-colors disabled:opacity-50"
              >
                {isSharing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                Share
              </button>
              <button
                onClick={handleNextChallenge}
                className="flex items-center gap-2 text-base text-primary hover:text-primary/80 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Next Challenge
              </button>
            </div>
          </div>
        )}
      </div>

      {/* XP Display - positioned to NOT collide with navigation */}
      <div
        ref={xpDisplayRef}
        className="fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-0"
      >
        <Zap className="w-4 h-4 text-yellow-500" />
        <span className="text-base text-muted-foreground tabular-nums">{stats.totalXP} XP</span>
      </div>

      {/* Fixed controls - bottom right */}
      {/* Metrics toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          const newEnabled = !metricsEnabled;
          setMetricsEnabled(newEnabled);
          if (!newEnabled) {
            setMetricsVisible(false); // Reset visibility when toggled off
          }
          setTimeout(() => textareaRef.current?.focus(), 0);
        }}
        className={`fixed bottom-4 right-36 w-8 h-8 flex items-center justify-center transition-colors ${
          metricsEnabled
            ? 'text-blue-500 hover:text-blue-600'
            : 'text-muted-foreground/60 hover:text-muted-foreground'
        }`}
        aria-label={metricsEnabled ? "Hide typing metrics" : "Show typing metrics"}
      >
        <Timer className="w-5 h-5" />
      </button>

      {/* Leaderboard */}
      <TransitionLink
        href="/leaderboard"
        className="fixed bottom-4 right-28 w-8 h-8 flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        aria-label="View leaderboard"
      >
        <Medal className="w-5 h-5" strokeWidth={1.5} />
      </TransitionLink>

      {/* Theme toggle */}
      {themeMounted && (
        <button
          onClick={toggleTheme}
          className="fixed bottom-4 right-20 w-8 h-8 flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>
      )}

      {/* Race flag button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setRace(prev => ({
            ...prev,
            enabled: !prev.enabled,
            llmPrompt: null,
            llmProgress: 0,
            raceStarted: false,
            startTime: null,
          }));
          setTimeout(() => textareaRef.current?.focus(), 0);
        }}
        className={`fixed bottom-4 right-12 w-8 h-8 flex items-center justify-center transition-colors ${
          race.enabled
            ? 'text-purple-500 hover:text-purple-600'
            : 'text-muted-foreground/60 hover:text-muted-foreground'
        }`}
        aria-label={race.enabled ? "Disable race mode" : "Enable race mode"}
      >
        <Flag className="w-5 h-5" />
      </button>

      {/* Sound toggle button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleSound();
          setTimeout(() => textareaRef.current?.focus(), 0);
        }}
        className="fixed bottom-4 right-4 w-8 h-8 flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        aria-label={soundEnabled ? "Mute keyboard sounds" : "Unmute keyboard sounds"}
      >
        {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
      </button>

      {/* Dramatic copy-paste warning modal */}
      {showCopyWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div ref={copyModalRef} className="bg-background border border-border rounded-2xl p-8 max-w-md mx-4 text-center">
            <div className="text-6xl mb-4">🤨</div>
            <h2 className="text-2xl font-bold text-foreground mb-4">
              IS THIS REALLY WHAT YOU WANT, SON?
            </h2>
            <p className="text-lg text-muted-foreground mb-2">REALLY?</p>
            <p className="text-lg text-muted-foreground mb-8">ARE YOU SURE?</p>
            <button
              onClick={handleCopyWarningConfirm}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Yes, Sir
            </button>
          </div>
        </div>
      )}

      {/* Goodboy response modal */}
      {showGoodboy && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div ref={goodboyModalRef} className="flex flex-col items-center">
            <div className="text-6xl mb-4">😏</div>
            <p className="text-2xl font-bold text-white">Goodboy</p>
          </div>
        </div>
      )}
    </div>
  );
}
