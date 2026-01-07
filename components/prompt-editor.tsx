"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useKeyboardSounds } from "@/lib/use-keyboard-sounds";
import { Volume2, VolumeX, Lightbulb, Send, Loader2 } from "lucide-react";
import type { LessonContent } from "@/lib/lessons/types";

interface PromptEditorProps {
  scenario: string;
  hints: string[];
  lessonContent: LessonContent;
  onSubmit: (prompt: string) => Promise<void>;
  isSubmitting?: boolean;
  disabled?: boolean;
  maxLength?: number;
}

export function PromptEditor({
  scenario,
  hints,
  onSubmit,
  isSubmitting = false,
  disabled = false,
  maxLength = 5000,
}: PromptEditorProps) {
  const [prompt, setPrompt] = useState("");
  const [showHints, setShowHints] = useState(false);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keyboard sounds
  const { playPressSound, playReleaseSound, enabled: soundEnabled, toggleSound } = useKeyboardSounds({
    initialEnabled: true,
    volume: 0.9
  });

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.max(200, textarea.scrollHeight)}px`;
    }
  }, [prompt]);

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= maxLength) {
      setPrompt(value);
    }
  }, [maxLength]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Submit on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !isSubmitting && prompt.trim().length > 0) {
      e.preventDefault();
      onSubmit(prompt);
      return;
    }

    // Play press sound for printable characters, backspace, enter, and space
    if (!e.repeat && (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter" || e.key === "Tab")) {
      playPressSound(e.key);
    }
  }, [isSubmitting, prompt, onSubmit, playPressSound]);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter" || e.key === "Tab") {
      playReleaseSound(e.key);
    }
  }, [playReleaseSound]);

  const handleSubmit = useCallback(async () => {
    if (prompt.trim().length === 0 || isSubmitting) return;
    await onSubmit(prompt);
  }, [prompt, isSubmitting, onSubmit]);

  const handleShowNextHint = useCallback(() => {
    if (!showHints) {
      setShowHints(true);
      setCurrentHintIndex(0);
    } else if (currentHintIndex < hints.length - 1) {
      setCurrentHintIndex(prev => prev + 1);
    }
  }, [showHints, currentHintIndex, hints.length]);

  const characterCount = prompt.length;
  const wordCount = prompt.trim().split(/\s+/).filter(Boolean).length;
  const isOverLimit = characterCount > maxLength;
  const canSubmit = prompt.trim().length > 0 && !isSubmitting && !disabled && !isOverLimit;

  return (
    <div className="w-full">
      {/* Scenario Display */}
      <div className="mb-6 p-6 bg-card rounded-lg border border-border">
        <h3 className="text-base-bold text-foreground mb-2">Your Challenge</h3>
        <p className="text-base text-foreground-2">{scenario}</p>
      </div>

      {/* Prompt Input Area */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          disabled={disabled || isSubmitting}
          placeholder="Write your prompt here..."
          className={`w-full min-h-[200px] p-4 bg-card border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-base text-foreground placeholder:text-muted-foreground transition-colors ${
            isOverLimit ? "border-destructive" : "border-border"
          } ${disabled || isSubmitting ? "opacity-60 cursor-not-allowed" : ""}`}
          aria-label="Write your prompt"
        />

        {/* Character/Word Count */}
        <div className="absolute bottom-3 right-3 flex items-center gap-3 text-small text-muted-foreground">
          <span>{wordCount} words</span>
          <span className={isOverLimit ? "text-destructive" : ""}>
            {characterCount}/{maxLength}
          </span>
        </div>
      </div>

      {/* Hints Section */}
      {hints.length > 0 && (
        <div className="mt-4">
          <button
            onClick={handleShowNextHint}
            className="flex items-center gap-2 text-small text-muted-foreground hover:text-foreground transition-colors"
            disabled={showHints && currentHintIndex >= hints.length - 1}
          >
            <Lightbulb className="w-4 h-4" />
            {!showHints
              ? "Need a hint?"
              : currentHintIndex < hints.length - 1
                ? `Show hint ${currentHintIndex + 2} of ${hints.length}`
                : "No more hints"
            }
          </button>

          {showHints && (
            <div className="mt-3 space-y-2">
              {hints.slice(0, currentHintIndex + 1).map((hint, index) => (
                <div
                  key={index}
                  className="p-3 bg-muted/50 rounded-md text-small text-foreground-2 animate-in fade-in slide-in-from-top-2 duration-300"
                >
                  <span className="font-medium">Hint {index + 1}:</span> {hint}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between mt-6">
        <div className="flex items-center gap-2 text-small text-muted-foreground">
          <kbd className="px-2 py-1 bg-muted rounded text-xs">
            {typeof navigator !== "undefined" && navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"} + Enter
          </kbd>
          <span>to submit</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Sound Toggle */}
          <button
            onClick={(e) => {
              e.preventDefault();
              toggleSound();
              textareaRef.current?.focus();
            }}
            className="p-2 text-muted-foreground/60 hover:text-muted-foreground transition-colors rounded-md"
            aria-label={soundEnabled ? "Mute keyboard sounds" : "Unmute keyboard sounds"}
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </button>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-base-bold transition-all ${
              canSubmit
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Evaluating...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Prompt
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
