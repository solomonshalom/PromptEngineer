import { callAIJSON, AIClientError } from "./groq-client";
import type { Challenge } from "../challenges";

export interface QuickEvaluationResult {
  score: number; // 0-100
  feedback: string; // Brief, one sentence feedback
  tip?: string; // Optional improvement tip
}

interface AIQuickEvaluationResponse {
  score: number;
  feedback: string;
  tip?: string;
}

// Sanitize user input to prevent prompt injection
function sanitizePrompt(prompt: string): string {
  const sanitized = prompt
    .slice(0, 5000) // Max 5k characters for challenges
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();

  return sanitized;
}

// Check for copy-paste and low-effort submissions
interface CheatingCheck {
  isCheating: boolean;
  reason?: string;
  penaltyScore?: number;
  feedback?: string;
  tip?: string;
}

function detectCheating(userPrompt: string, challenge: Challenge): CheatingCheck {
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
  const scenarioText = normalizeText(challenge.scenario);
  if (calculateSimilarity(userText, scenarioText) > 0.7) {
    return {
      isCheating: true,
      reason: "copied_scenario",
      penaltyScore: 15,
      feedback: "This appears to be a copy of the challenge, not an original prompt.",
      tip: "Write your own prompt that addresses the scenario.",
    };
  }

  // Check 2: Copy-pasted good example (if available)
  if (challenge.exampleGoodPrompt) {
    const goodExampleText = normalizeText(challenge.exampleGoodPrompt);
    if (calculateSimilarity(userText, goodExampleText) > 0.8) {
      return {
        isCheating: true,
        reason: "copied_good_example",
        penaltyScore: 20,
        feedback: "This looks like the example prompt. Practice writing your own!",
        tip: "Use the example as inspiration, but create something original.",
      };
    }
  }

  // Check 3: Minimal effort (too short)
  if (userPrompt.trim().length < 15) {
    return {
      isCheating: true,
      reason: "too_short",
      penaltyScore: 25,
      feedback: "This prompt is too short to demonstrate understanding.",
      tip: "Write a more complete prompt that shows the technique.",
    };
  }

  // Check 4: Repetitive/gibberish text
  const words = userPrompt.split(/\s+/);
  if (words.length > 5) {
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const uniqueRatio = uniqueWords.size / words.length;
    if (uniqueRatio < 0.3) {
      return {
        isCheating: true,
        reason: "repetitive",
        penaltyScore: 20,
        feedback: "This prompt contains too much repetitive content.",
        tip: "Write a meaningful prompt with varied, purposeful content.",
      };
    }
  }

  // Check 5: Just numbers or special characters
  const alphaCount = (userPrompt.match(/[a-zA-Z]/g) || []).length;
  if (alphaCount < userPrompt.length * 0.3 && userPrompt.length > 10) {
    return {
      isCheating: true,
      reason: "gibberish",
      penaltyScore: 25,
      feedback: "This doesn't appear to be a valid prompt attempt.",
      tip: "Write a genuine prompt using proper language.",
    };
  }

  return { isCheating: false };
}

export async function evaluateChallenge(
  userPrompt: string,
  challenge: Challenge
): Promise<QuickEvaluationResult> {
  const sanitizedPrompt = sanitizePrompt(userPrompt);

  if (sanitizedPrompt.length === 0) {
    return {
      score: 0,
      feedback: "No prompt submitted.",
    };
  }

  // Check for cheating/low-effort submissions BEFORE calling AI
  const cheatingCheck = detectCheating(sanitizedPrompt, challenge);
  if (cheatingCheck.isCheating) {
    return {
      score: cheatingCheck.penaltyScore || 15,
      feedback: cheatingCheck.feedback || "This submission doesn't appear to be a genuine attempt.",
      tip: cheatingCheck.tip || "Please submit an original prompt.",
    };
  }

  const systemPrompt = `You are a prompt engineering evaluator. Give quick, focused feedback.

Respond with JSON:
{
  "score": <0-100 based on prompt quality>,
  "feedback": "<one sentence summary of how well they did>",
  "tip": "<optional: one quick improvement suggestion>"
}

CRITICAL - CHEATING DETECTION:
- If the student's prompt is suspiciously similar to the challenge scenario, give a LOW score (under 30)
- If they copied the example prompt verbatim or with minor changes, give a LOW score (under 30)
- If the prompt is too short (under 20 characters) or low-effort, give a LOW score (under 30)
- If the prompt is gibberish, repetitive, or doesn't make sense, give a LOW score (under 30)
- The student should demonstrate ORIGINAL thinking, not just copy content

Be encouraging but honest for genuine attempts. Score based on:
- Clarity and specificity
- Appropriate use of the technique
- Likely effectiveness with an LLM`;

  const userMessage = `Challenge: ${challenge.title}
Technique: ${challenge.technique}
Task: ${challenge.scenario}

${challenge.exampleGoodPrompt ? `Reference (good example): ${challenge.exampleGoodPrompt}` : ""}

Student's prompt:
${sanitizedPrompt}

Evaluate briefly. Focus on ${challenge.evaluationFocus.join(", ")}.`;

  try {
    const response = await callAIJSON<AIQuickEvaluationResponse>(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      {
        temperature: 0.1,
        max_tokens: 256, // Keep responses short
      }
    );

    return {
      score: Math.max(0, Math.min(100, Math.round(response.score || 50))),
      feedback: response.feedback || "Evaluation complete.",
      tip: response.tip,
    };
  } catch (error) {
    if (error instanceof AIClientError) {
      console.error("AI API error in challenge evaluation:", error.message);
    } else {
      console.error("Unexpected error in challenge evaluation:", error);
    }

    // Return a fallback evaluation on error
    return {
      score: 50,
      feedback: "Unable to evaluate right now. Try again!",
    };
  }
}

// Generate an "LLM response" for race mode - simulates what a good prompt would look like
export async function generateLLMPrompt(challenge: Challenge): Promise<string> {
  // If we have an example good prompt, use that with slight variation
  if (challenge.exampleGoodPrompt) {
    return challenge.exampleGoodPrompt;
  }

  // Otherwise generate one (but this is slower, so we prefer to use examples)
  const systemPrompt = `Generate a well-crafted prompt for this scenario. Be concise.`;

  const userMessage = `Challenge: ${challenge.scenario}
Technique to use: ${challenge.technique}
Expected length: ${challenge.expectedLength === "short" ? "1-2 sentences" : challenge.expectedLength === "medium" ? "2-4 sentences" : "4-6 sentences"}

Generate a high-quality prompt. Just the prompt, no explanation.`;

  try {
    const response = await callAIJSON<{ prompt: string }>(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      {
        temperature: 0.3,
        max_tokens: 256,
      }
    );

    return response.prompt || challenge.exampleGoodPrompt || "Unable to generate prompt.";
  } catch {
    return challenge.exampleGoodPrompt || "Unable to generate prompt.";
  }
}
