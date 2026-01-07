import { callAIJSON, AIClientError } from "./groq-client";
import type { LessonContent } from "../lessons/types";

export interface AdaptiveScenarioContent {
  scenario: string;
  targetBehavior: string;
  hints: string[];
  difficulty: "easier" | "standard" | "harder";
}

export type DifficultyLevel = "easier" | "standard" | "harder";

interface GenerateScenarioParams {
  lessonTitle: string;
  technique: string;
  baseScenario: string;
  baseTargetBehavior: string;
  baseHints: string[];
  keyPrinciples: string[];
  goodExample: LessonContent["goodExample"];
  difficulty: DifficultyLevel;
  previousScenarios?: string[]; // To avoid repetition
}

interface AIScenarioResponse {
  scenario: string;
  targetBehavior: string;
  hints: string[];
}

/**
 * Generate an adaptive scenario based on difficulty level
 * - "easier": More guidance, simpler task, more explicit hints
 * - "standard": Original difficulty, fresh scenario
 * - "harder": Less guidance, more complex task, subtle hints
 */
export async function generateAdaptiveScenario(
  params: GenerateScenarioParams
): Promise<AdaptiveScenarioContent> {
  const {
    lessonTitle,
    technique,
    baseScenario,
    baseTargetBehavior,
    baseHints,
    keyPrinciples,
    goodExample,
    difficulty,
    previousScenarios = [],
  } = params;

  const systemPrompt = buildSystemPrompt(difficulty);
  const userMessage = buildUserMessage({
    lessonTitle,
    technique,
    baseScenario,
    baseTargetBehavior,
    baseHints,
    keyPrinciples,
    goodExample,
    difficulty,
    previousScenarios,
  });

  try {
    const response = await callAIJSON<AIScenarioResponse>(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      {
        temperature: 0.8, // Higher temperature for variety
        max_tokens: 1024,
      }
    );

    return {
      scenario: response.scenario || baseScenario,
      targetBehavior: response.targetBehavior || baseTargetBehavior,
      hints: Array.isArray(response.hints) ? response.hints.slice(0, 4) : baseHints,
      difficulty,
    };
  } catch (error) {
    if (error instanceof AIClientError) {
      console.error("AI error generating scenario:", error.message);
    } else {
      console.error("Error generating scenario:", error);
    }

    // Fallback to base scenario with difficulty modifier
    return {
      scenario: baseScenario,
      targetBehavior: baseTargetBehavior,
      hints: baseHints,
      difficulty,
    };
  }
}

function buildSystemPrompt(difficulty: DifficultyLevel): string {
  const difficultyGuidance = {
    easier: `Create a SIMPLER version of the scenario:
- More explicit guidance on what's expected
- Simpler context with fewer variables
- More detailed hints that guide toward the answer
- Focus on one core aspect of the technique`,

    standard: `Create a FRESH scenario of SIMILAR difficulty:
- Same complexity as the original
- Different context/domain to encourage diverse practice
- Balanced hints that guide without giving away the answer`,

    harder: `Create a MORE CHALLENGING version:
- More complex real-world context
- Multiple considerations to balance
- Subtle hints that require deeper understanding
- May require combining techniques or handling edge cases`,
  };

  return `You are an expert prompt engineering curriculum designer.

Your task is to create a ${difficulty} practice scenario for teaching a prompt engineering technique.

${difficultyGuidance[difficulty]}

IMPORTANT: You must respond with valid JSON matching this exact structure:
{
  "scenario": "<the practice scenario/task for the student>",
  "targetBehavior": "<what the student's prompt should achieve>",
  "hints": ["<hint 1>", "<hint 2>", "<hint 3>"]
}

Guidelines:
- Keep scenarios practical and relevant to real-world prompt engineering
- Make the scenario self-contained (student doesn't need external context)
- Hints should progressively reveal more without giving away the answer
- Each scenario should be unique and engaging`;
}

function buildUserMessage(params: {
  lessonTitle: string;
  technique: string;
  baseScenario: string;
  baseTargetBehavior: string;
  baseHints: string[];
  keyPrinciples: string[];
  goodExample: LessonContent["goodExample"];
  difficulty: DifficultyLevel;
  previousScenarios: string[];
}): string {
  const {
    lessonTitle,
    technique,
    baseScenario,
    baseTargetBehavior,
    keyPrinciples,
    goodExample,
    difficulty,
    previousScenarios,
  } = params;

  let avoidSection = "";
  if (previousScenarios.length > 0) {
    avoidSection = `\n## Scenarios to AVOID (create something different)
${previousScenarios.map((s, i) => `${i + 1}. ${s.slice(0, 100)}...`).join("\n")}`;
  }

  return `# Lesson: ${lessonTitle}
# Technique: ${technique}
# Difficulty: ${difficulty.toUpperCase()}

## Key Principles of This Technique
${keyPrinciples.map((p, i) => `${i + 1}. ${p}`).join("\n")}

## Example of Good Application
Prompt: ${goodExample.prompt}
Why it works: ${goodExample.explanation}

## Original Scenario (for reference)
${baseScenario}

Expected behavior: ${baseTargetBehavior}
${avoidSection}

---
Generate a ${difficulty === "easier" ? "simpler" : difficulty === "harder" ? "more challenging" : "fresh"} scenario that tests the same ${technique} technique.

Respond with JSON containing: scenario, targetBehavior, hints (array of 3)`;
}

/**
 * Determine appropriate difficulty based on user's recent performance
 */
export function calculateAdaptiveDifficulty(
  recentScores: number[],
  passingScore: number = 70
): DifficultyLevel {
  if (recentScores.length === 0) {
    return "standard";
  }

  // Get last 3 attempts
  const lastThree = recentScores.slice(-3);
  const avgScore = lastThree.reduce((a, b) => a + b, 0) / lastThree.length;
  const passRate = lastThree.filter(s => s >= passingScore).length / lastThree.length;

  // User struggling: make it easier
  if (avgScore < 50 || passRate < 0.33) {
    return "easier";
  }

  // User excelling: make it harder
  if (avgScore >= 85 && passRate >= 0.67) {
    return "harder";
  }

  // Otherwise: standard difficulty
  return "standard";
}
