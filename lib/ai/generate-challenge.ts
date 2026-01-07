import { callAIJSON, AIClientError } from "./groq-client";
import { challenges, type Challenge } from "../challenges";

export interface GeneratedChallenge {
  title: string;
  scenario: string;
  technique: string;
  difficulty: "easy" | "medium" | "hard";
  expectedLength: "short" | "medium" | "long";
  evaluationFocus: string[];
  exampleGoodPrompt: string;
}

interface AIGeneratedChallenge {
  title: string;
  scenario: string;
  expectedLength: "short" | "medium" | "long";
  evaluationFocus: string[];
  exampleGoodPrompt: string;
}

// Techniques to generate challenges for
const TECHNIQUES = [
  "Clear Instructions",
  "Output Format",
  "Role Prompting",
  "Few-Shot Prompting",
  "Chain of Thought",
  "Context Setting",
  "System Prompts",
  "Constraint Specification",
  "Task Decomposition",
];

// Get random technique
function getRandomTechnique(): string {
  return TECHNIQUES[Math.floor(Math.random() * TECHNIQUES.length)];
}

// Get random difficulty
function getRandomDifficulty(): "easy" | "medium" | "hard" {
  const difficulties: Array<"easy" | "medium" | "hard"> = ["easy", "medium", "hard"];
  return difficulties[Math.floor(Math.random() * difficulties.length)];
}

/**
 * Generate a new challenge using AI
 */
export async function generateChallenge(
  options: {
    technique?: string;
    difficulty?: "easy" | "medium" | "hard";
    previousScenarios?: string[];
  } = {}
): Promise<GeneratedChallenge> {
  const technique = options.technique || getRandomTechnique();
  const difficulty = options.difficulty || getRandomDifficulty();
  const previousScenarios = options.previousScenarios || [];

  // Find existing challenges with this technique for reference
  const referenceChallenge = challenges.find(c => c.technique === technique);

  const systemPrompt = buildSystemPrompt(technique, difficulty);
  const userMessage = buildUserMessage(technique, difficulty, referenceChallenge, previousScenarios);

  try {
    const response = await callAIJSON<AIGeneratedChallenge>(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      {
        temperature: 0.9, // High temperature for variety
        max_tokens: 1024,
      }
    );

    // Validate and sanitize response
    return {
      title: sanitizeString(response.title) || `${technique} Challenge`,
      scenario: sanitizeString(response.scenario) || "Write a prompt that demonstrates this technique effectively.",
      technique,
      difficulty,
      expectedLength: validateExpectedLength(response.expectedLength),
      evaluationFocus: validateEvaluationFocus(response.evaluationFocus),
      exampleGoodPrompt: sanitizeString(response.exampleGoodPrompt) || "",
    };
  } catch (error) {
    if (error instanceof AIClientError) {
      console.error("AI error generating challenge:", error.message);
    } else {
      console.error("Error generating challenge:", error);
    }
    throw error; // Re-throw so caller can handle fallback
  }
}

/**
 * Generate multiple challenges in batch
 */
export async function generateChallengesBatch(
  count: number,
  existingScenarios: string[] = []
): Promise<GeneratedChallenge[]> {
  const generated: GeneratedChallenge[] = [];
  const scenarios = [...existingScenarios];

  for (let i = 0; i < count; i++) {
    try {
      const challenge = await generateChallenge({
        previousScenarios: scenarios.slice(-5), // Last 5 to avoid repetition
      });
      generated.push(challenge);
      scenarios.push(challenge.scenario);
    } catch (error) {
      console.error(`Failed to generate challenge ${i + 1}/${count}:`, error);
      // Continue with remaining challenges
    }
  }

  return generated;
}

function buildSystemPrompt(technique: string, difficulty: "easy" | "medium" | "hard"): string {
  const difficultyGuidance = {
    easy: `Create a BEGINNER-FRIENDLY challenge:
- Clear, straightforward task
- Obvious application of the technique
- Single focus, no distractions
- Very specific about what's expected`,

    medium: `Create an INTERMEDIATE challenge:
- Real-world applicable scenario
- Requires understanding of the technique
- Some nuance in application
- Multiple valid approaches possible`,

    hard: `Create an ADVANCED challenge:
- Complex real-world scenario
- Requires deep understanding
- Multiple considerations to balance
- Creative application needed`,
  };

  return `You are an expert prompt engineering instructor creating practice challenges.

Your task is to create a ${difficulty.toUpperCase()} challenge that teaches the "${technique}" technique.

${difficultyGuidance[difficulty]}

RESPOND WITH VALID JSON ONLY:
{
  "title": "<short catchy title, 2-4 words>",
  "scenario": "<the task/scenario for the user, 1-3 sentences>",
  "expectedLength": "<short|medium|long>",
  "evaluationFocus": ["<aspect1>", "<aspect2>", "<aspect3>"],
  "exampleGoodPrompt": "<a good example prompt that would score well>"
}

Guidelines:
- Scenario should be practical and engaging
- Title should be catchy and hint at the task
- expectedLength: short (1-2 sentences), medium (3-5 sentences), long (6+ sentences)
- evaluationFocus: 3 specific things to evaluate in the user's prompt
- exampleGoodPrompt: a high-quality example (this helps with evaluation)`;
}

function buildUserMessage(
  technique: string,
  difficulty: "easy" | "medium" | "hard",
  reference: Challenge | undefined,
  previousScenarios: string[]
): string {
  let message = `Create a ${difficulty} challenge for the "${technique}" technique.\n\n`;

  if (reference) {
    message += `## Reference Example (create something DIFFERENT)
Title: ${reference.title}
Scenario: ${reference.scenario}
Good Prompt: ${reference.exampleGoodPrompt || "N/A"}

`;
  }

  if (previousScenarios.length > 0) {
    message += `## Previously Generated (AVOID similar scenarios)
${previousScenarios.map((s, i) => `${i + 1}. ${s.slice(0, 80)}...`).join("\n")}

`;
  }

  message += `Generate a fresh, unique challenge that tests ${technique}. Make it practical and engaging.`;

  return message;
}

// Helpers for validation and sanitization
function sanitizeString(str: unknown): string {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, 2000); // Limit length
}

function validateExpectedLength(length: unknown): "short" | "medium" | "long" {
  if (length === "short" || length === "medium" || length === "long") {
    return length;
  }
  return "medium";
}

function validateEvaluationFocus(focus: unknown): string[] {
  if (!Array.isArray(focus)) return ["clarity", "technique application", "effectiveness"];
  return focus
    .filter((f): f is string => typeof f === "string")
    .map(f => f.trim().slice(0, 100))
    .slice(0, 5);
}

/**
 * Create a content hash for deduplication
 */
export function createContentHash(scenario: string): string {
  // Simple hash based on normalized content
  const normalized = scenario.toLowerCase().replace(/\s+/g, " ").trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `ch_${Math.abs(hash).toString(36)}`;
}
