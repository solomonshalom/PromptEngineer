"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Sparkles, ArrowRight, RotateCcw } from "lucide-react";
import type { EvaluationResult } from "@/lib/lessons/types";

interface LessonFeedbackProps {
  evaluation: EvaluationResult;
  passingScore: number;
  onRetry: () => void;
  onContinue: () => void;
  hasNextLesson: boolean;
}

export function LessonFeedback({
  evaluation,
  passingScore,
  onRetry,
  onContinue,
  hasNextLesson,
}: LessonFeedbackProps) {
  const [showDetails, setShowDetails] = useState(false);
  const passed = evaluation.overallScore >= passingScore;

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Score Header */}
      <div className={`p-6 rounded-t-lg ${passed ? "bg-green-500/10" : "bg-orange-500/10"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {passed ? (
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            ) : (
              <XCircle className="w-8 h-8 text-orange-500" />
            )}
            <div>
              <h3 className="text-medium text-foreground">
                {passed ? "Great job!" : "Keep practicing!"}
              </h3>
              <p className="text-small text-muted-foreground">
                {passed
                  ? "You've demonstrated understanding of this technique."
                  : `Score ${passingScore}+ to unlock the next lesson.`}
              </p>
            </div>
          </div>

          {/* Score Circle */}
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
              {/* Background circle */}
              <circle
                cx="40"
                cy="40"
                r="35"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-muted/30"
              />
              {/* Progress circle */}
              <circle
                cx="40"
                cy="40"
                r="35"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${(evaluation.overallScore / 100) * 220} 220`}
                className={passed ? "text-green-500" : "text-orange-500"}
                style={{
                  transition: "stroke-dasharray 1s ease-out",
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-large text-foreground">{evaluation.overallScore}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Criteria Breakdown */}
      <div className="p-6 bg-card border-x border-border">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center justify-between w-full text-base text-foreground hover:text-foreground/80 transition-colors"
        >
          <span className="font-medium">Criteria Breakdown</span>
          {showDetails ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>

        {showDetails && (
          <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {evaluation.criteriaScores.map((criterion, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between text-small">
                  <span className="text-foreground">{criterion.criterion}</span>
                  <span
                    className={
                      criterion.score >= 70
                        ? "text-green-500"
                        : criterion.score >= 50
                          ? "text-orange-500"
                          : "text-red-500"
                    }
                  >
                    {criterion.score}/100
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      criterion.score >= 70
                        ? "bg-green-500"
                        : criterion.score >= 50
                          ? "bg-orange-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${criterion.score}%` }}
                  />
                </div>
                <p className="text-small text-muted-foreground">{criterion.feedback}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Strengths & Improvements */}
      <div className="p-6 bg-card border-x border-border space-y-6">
        {/* Strengths */}
        {evaluation.strengths.length > 0 && (
          <div>
            <h4 className="text-base-bold text-green-500 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Strengths
            </h4>
            <ul className="space-y-2">
              {evaluation.strengths.map((strength, index) => (
                <li key={index} className="text-small text-foreground-2 flex items-start gap-2">
                  <span className="text-green-500 mt-1">•</span>
                  {strength}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Improvements */}
        {evaluation.improvements.length > 0 && (
          <div>
            <h4 className="text-base-bold text-orange-500 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Areas for Improvement
            </h4>
            <ul className="space-y-2">
              {evaluation.improvements.map((improvement, index) => (
                <li key={index} className="text-small text-foreground-2 flex items-start gap-2">
                  <span className="text-orange-500 mt-1">•</span>
                  {improvement}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Suggested Revision */}
      {evaluation.revisedPromptSuggestion && (
        <div className="p-6 bg-card border-x border-border">
          <h4 className="text-base-bold text-foreground mb-3">Suggested Prompt</h4>
          <div className="p-4 bg-muted/50 rounded-lg border border-border">
            <pre className="text-small text-foreground-2 whitespace-pre-wrap font-mono">
              {evaluation.revisedPromptSuggestion}
            </pre>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="p-6 bg-card rounded-b-lg border-x border-b border-border flex items-center justify-end gap-3">
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-base text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Try Again
        </button>

        {passed && hasNextLesson && (
          <button
            onClick={onContinue}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-base-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Next Lesson
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
