import { callAIJSON, AIClientError } from "./groq-client";
import type { LessonContent, EvaluationResult, AIEvaluationResponse } from "../lessons/types";

// Rate limiting - simple in-memory store (per-server instance)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10; // Max requests per window
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window
const ANON_RATE_LIMIT_KEY = "anonymous"; // Single bucket for anonymous users (conservative)

export class RateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super(`Rate limit exceeded. Please try again in ${retryAfterSeconds} seconds.`);
    this.name = "RateLimitError";
  }
}

/**
 * Check rate limit for a user
 * @param identifier - User ID for authenticated users, or undefined for anonymous
 * Falls back to a shared anonymous bucket to prevent abuse
 */
function checkRateLimit(identifier?: string): void {
  // Use user ID if available, otherwise use shared anonymous bucket
  // This is a conservative approach - all anonymous users share a rate limit
  const key = identifier || ANON_RATE_LIMIT_KEY;
  const now = Date.now();
  const limit = rateLimitStore.get(key);

  if (!limit || now > limit.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return;
  }

  if (limit.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((limit.resetAt - now) / 1000);
    throw new RateLimitError(retryAfter);
  }

  limit.count++;
}

// Sanitize user input to prevent prompt injection
function sanitizePrompt(prompt: string): string {
  // Remove potential control sequences and limit length
  const sanitized = prompt
    .slice(0, 10000) // Max 10k characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control chars except newline/tab
    .trim();

  return sanitized;
}

// Check for copy-paste and low-effort submissions
interface CheatingCheck {
  isCheating: boolean;
  reason?: string;
  penaltyScore?: number;
}

function detectCheating(userPrompt: string, lessonContent: LessonContent): CheatingCheck {
  const normalizeText = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
  const userText = normalizeText(userPrompt);

  // Helper to calculate similarity
  const calculateSimilarity = (a: string, b: string): number => {
    if (a.length < 15 || b.length < 15) return 0;
    const wordsA = new Set(a.split(' ').filter(w => w.length > 3));
    const wordsB = new Set(b.split(' ').filter(w => w.length > 3));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    return intersection / Math.min(wordsA.size, wordsB.size);
  };

  // Check 1: Copy-pasted scenario
  const scenarioText = normalizeText(lessonContent.scenario);
  if (calculateSimilarity(userText, scenarioText) > 0.7) {
    return {
      isCheating: true,
      reason: "copied_scenario",
      penaltyScore: 15,
    };
  }

  // Check 2: Copy-pasted good example
  const goodExampleText = normalizeText(lessonContent.goodExample.prompt);
  if (calculateSimilarity(userText, goodExampleText) > 0.8) {
    return {
      isCheating: true,
      reason: "copied_good_example",
      penaltyScore: 20,
    };
  }

  // Check 3: Copy-pasted bad example
  const badExampleText = normalizeText(lessonContent.badExample.prompt);
  if (calculateSimilarity(userText, badExampleText) > 0.8) {
    return {
      isCheating: true,
      reason: "copied_bad_example",
      penaltyScore: 10,
    };
  }

  // Check 4: Minimal effort (too short)
  if (userPrompt.trim().length < 15) {
    return {
      isCheating: true,
      reason: "too_short",
      penaltyScore: 25,
    };
  }

  // Check 5: Repetitive/gibberish text
  const words = userPrompt.split(/\s+/);
  if (words.length > 5) {
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const uniqueRatio = uniqueWords.size / words.length;
    if (uniqueRatio < 0.3) {
      return {
        isCheating: true,
        reason: "repetitive",
        penaltyScore: 20,
      };
    }
  }

  // Check 6: Just numbers or special characters
  const alphaCount = (userPrompt.match(/[a-zA-Z]/g) || []).length;
  if (alphaCount < userPrompt.length * 0.3 && userPrompt.length > 10) {
    return {
      isCheating: true,
      reason: "gibberish",
      penaltyScore: 25,
    };
  }

  return { isCheating: false };
}

interface EvaluatePromptParams {
  userPrompt: string;
  lessonContent: LessonContent;
  lessonTitle: string;
  technique: string;
  userId?: string;
  passingScore?: number; // Default: 70
}

export async function evaluatePrompt({
  userPrompt,
  lessonContent,
  lessonTitle,
  technique,
  userId,
  passingScore = 70,
}: EvaluatePromptParams): Promise<EvaluationResult> {
  // Rate limit check - always applied, with anonymous fallback
  checkRateLimit(userId);

  // Sanitize input
  const sanitizedPrompt = sanitizePrompt(userPrompt);

  if (sanitizedPrompt.length === 0) {
    return {
      overallScore: 0,
      criteriaScores: lessonContent.evaluationCriteria.map(c => ({
        criterion: c.criterion,
        score: 0,
        feedback: "No prompt was submitted.",
      })),
      strengths: [],
      improvements: ["Submit a prompt to receive feedback."],
      passed: false,
    };
  }

  // Check for cheating/low-effort submissions
  const cheatingCheck = detectCheating(sanitizedPrompt, lessonContent);
  if (cheatingCheck.isCheating) {
    const reasonMessages: Record<string, { feedback: string; improvement: string }> = {
      copied_scenario: {
        feedback: "This appears to be a copy of the challenge scenario, not an original prompt.",
        improvement: "Write your own prompt that addresses the scenario, don't copy the scenario itself.",
      },
      copied_good_example: {
        feedback: "This appears to be copied from the example. The goal is to practice writing your own prompts.",
        improvement: "Try writing your own prompt using the principles you learned, rather than copying the example.",
      },
      copied_bad_example: {
        feedback: "This appears to be copied from the 'Avoid This' example.",
        improvement: "Write your own prompt that demonstrates the technique correctly.",
      },
      too_short: {
        feedback: "This prompt is too short to demonstrate understanding of the technique.",
        improvement: "Write a more complete prompt that shows you understand the technique being taught.",
      },
      repetitive: {
        feedback: "This prompt contains too much repetitive content.",
        improvement: "Write a meaningful prompt with varied, purposeful content.",
      },
      gibberish: {
        feedback: "This doesn't appear to be a valid prompt attempt.",
        improvement: "Write a genuine prompt using proper language to practice the technique.",
      },
    };

    const message = reasonMessages[cheatingCheck.reason || ""] || {
      feedback: "This submission doesn't appear to be a genuine attempt.",
      improvement: "Please submit an original prompt that demonstrates the technique.",
    };

    return {
      overallScore: cheatingCheck.penaltyScore || 15,
      criteriaScores: lessonContent.evaluationCriteria.map(c => ({
        criterion: c.criterion,
        score: cheatingCheck.penaltyScore || 15,
        feedback: message.feedback,
      })),
      strengths: [],
      improvements: [message.improvement, "The goal is to practice writing prompts, not to game the system."],
      passed: false,
    };
  }

  // Build evaluation prompt for Groq
  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage({
    userPrompt: sanitizedPrompt,
    lessonContent,
    lessonTitle,
    technique,
  });

  try {
    const response = await callAIJSON<AIEvaluationResponse>(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      {
        temperature: 0.1, // Low temperature for consistent evaluation
        max_tokens: 2048,
      }
    );

    // Validate and normalize response
    const evaluation = normalizeEvaluation(response, lessonContent, passingScore);

    return evaluation;
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw error;
    }

    if (error instanceof AIClientError) {
      console.error("AI API error:", error.message, error.responseBody);
      throw new Error("Failed to evaluate prompt. Please try again.");
    }

    console.error("Unexpected error evaluating prompt:", error);
    throw new Error("An unexpected error occurred. Please try again.");
  }
}

function buildSystemPrompt(): string {
  return `You are an expert prompt engineering instructor evaluating a student's prompt.

Your role is to:
1. Assess how well the student's prompt demonstrates the technique being taught
2. Provide constructive, educational feedback
3. Score objectively based on the evaluation criteria
4. Suggest specific improvements

Be encouraging but honest. Point out both strengths and areas for improvement.
Focus on practical prompt engineering skills that transfer to real-world use.

CRITICAL - CHEATING DETECTION:
- If the student's prompt is suspiciously similar to the scenario text, give a LOW score (under 30)
- If they copied the good example verbatim or with minor changes, give a LOW score (under 30)
- If the prompt is too short (under 20 characters) or low-effort, give a LOW score (under 30)
- If the prompt is gibberish, repetitive, or doesn't make sense, give a LOW score (under 30)
- The student should demonstrate ORIGINAL thinking, not just copy content

IMPORTANT: You must respond with valid JSON matching this exact structure:
{
  "overallScore": <number 0-100>,
  "criteriaScores": [
    {"criterion": "<criterion name>", "score": <number 0-100>, "feedback": "<specific feedback>"}
  ],
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"],
  "revisedPromptSuggestion": "<optional: a better version of their prompt>"
}`;
}

function buildUserMessage({
  userPrompt,
  lessonContent,
  lessonTitle,
  technique,
}: Omit<EvaluatePromptParams, "userId">): string {
  const criteriaList = lessonContent.evaluationCriteria
    .map(c => `- ${c.criterion} (${c.weight}%): ${c.description}`)
    .join("\n");

  return `# Lesson: ${lessonTitle}
# Technique Being Taught: ${technique}

## Scenario
${lessonContent.scenario}

## Target Behavior
The student's prompt should: ${lessonContent.targetBehavior}

## Evaluation Criteria
${criteriaList}

## Good Example (for reference)
Prompt: ${lessonContent.goodExample.prompt}
Why it works: ${lessonContent.goodExample.explanation}

## Student's Submitted Prompt
${userPrompt}

---
Evaluate the student's prompt based on the criteria above. Be specific in your feedback.
Consider:
- Does the prompt demonstrate understanding of the ${technique} technique?
- Would this prompt produce the desired result in a real LLM interaction?
- What specific improvements would make this prompt more effective?

Respond with your evaluation as JSON.`;
}

function normalizeEvaluation(
  response: AIEvaluationResponse,
  lessonContent: LessonContent,
  passingScore: number = 70
): EvaluationResult {
  // Ensure overall score is within bounds
  const overallScore = Math.max(0, Math.min(100, Math.round(response.overallScore || 0)));

  // Normalize criteria scores
  const criteriaScores = lessonContent.evaluationCriteria.map(criterion => {
    const responseScore = response.criteriaScores?.find(
      (cs: { criterion: string; score: number; feedback: string }) =>
        cs.criterion.toLowerCase().includes(criterion.criterion.toLowerCase().slice(0, 10))
    );

    return {
      criterion: criterion.criterion,
      score: Math.max(0, Math.min(100, Math.round(responseScore?.score || 0))),
      feedback: responseScore?.feedback || "No specific feedback available.",
    };
  });

  // Ensure arrays exist and are properly typed
  const strengths = Array.isArray(response.strengths)
    ? response.strengths.filter((s: unknown) => typeof s === "string").slice(0, 5)
    : [];

  const improvements = Array.isArray(response.improvements)
    ? response.improvements.filter((s: unknown) => typeof s === "string").slice(0, 5)
    : [];

  // Use the lesson's passing score instead of hardcoded value
  const passed = overallScore >= passingScore;

  return {
    overallScore,
    criteriaScores,
    strengths,
    improvements,
    revisedPromptSuggestion: response.revisedPromptSuggestion || undefined,
    passed,
  };
}
