// Quick bite-sized prompt engineering challenges for the homepage

export interface Challenge {
  id: string;
  title: string;
  scenario: string;
  technique: string;
  difficulty: "easy" | "medium" | "hard";
  expectedLength: "short" | "medium" | "long"; // Hint for users
  evaluationFocus: string[]; // What to evaluate
  exampleGoodPrompt?: string; // For AI evaluation reference
}

export const challenges: Challenge[] = [
  // Easy challenges - fundamentals
  {
    id: "clear-instruction-1",
    title: "Be Specific",
    scenario: "Ask an AI to explain what a variable is in programming. Make your prompt clear and specific about the audience (beginner programmer).",
    technique: "Clear Instructions",
    difficulty: "easy",
    expectedLength: "short",
    evaluationFocus: ["specificity", "audience awareness", "clarity"],
    exampleGoodPrompt: "Explain what a variable is in programming to a complete beginner. Use a simple real-world analogy and avoid technical jargon.",
  },
  {
    id: "output-format-1",
    title: "Format Control",
    scenario: "Ask an AI to list 3 benefits of exercise. Specify that you want it as a numbered list with one sentence per benefit.",
    technique: "Output Format",
    difficulty: "easy",
    expectedLength: "short",
    evaluationFocus: ["format specification", "clarity", "constraints"],
    exampleGoodPrompt: "List 3 benefits of regular exercise. Format as a numbered list (1, 2, 3) with exactly one sentence per benefit.",
  },
  {
    id: "role-basic-1",
    title: "Simple Role",
    scenario: "You need help writing a thank-you email. Ask the AI to act as a professional email writer.",
    technique: "Role Prompting",
    difficulty: "easy",
    expectedLength: "short",
    evaluationFocus: ["role assignment", "task clarity"],
    exampleGoodPrompt: "Act as a professional email writer. Help me write a brief thank-you email to a colleague who helped me with a project.",
  },

  // Medium challenges - techniques
  {
    id: "few-shot-1",
    title: "Pattern Teaching",
    scenario: "Create a prompt that teaches the AI your preferred format for meeting notes by showing 2 examples, then asking it to format a new meeting note.",
    technique: "Few-Shot Prompting",
    difficulty: "medium",
    expectedLength: "medium",
    evaluationFocus: ["example quality", "pattern clarity", "consistency"],
    exampleGoodPrompt: "Format meeting notes like this:\nExample 1:\nInput: Discussed Q4 goals with marketing\nOutput: Meeting: Q4 Goals | Team: Marketing | Key Points: Discussed objectives\n\nExample 2:\nInput: Budget review with finance team\nOutput: Meeting: Budget Review | Team: Finance | Key Points: Reviewed numbers\n\nNow format: Weekly sync with engineering about the new feature launch",
  },
  {
    id: "chain-of-thought-1",
    title: "Step by Step",
    scenario: "Ask the AI to solve this: 'A store has 150 apples. They sell 40% on Monday and half of what remains on Tuesday. How many are left?' Use chain-of-thought prompting.",
    technique: "Chain of Thought",
    difficulty: "medium",
    expectedLength: "short",
    evaluationFocus: ["step-by-step instruction", "reasoning request"],
    exampleGoodPrompt: "A store has 150 apples. They sell 40% on Monday and half of what remains on Tuesday. How many apples are left? Think through this step by step, showing your work for each day.",
  },
  {
    id: "context-setting-1",
    title: "Context Master",
    scenario: "You're writing documentation for a REST API endpoint. Write a prompt that provides enough context about the endpoint, its purpose, and who will read the docs.",
    technique: "Context Setting",
    difficulty: "medium",
    expectedLength: "medium",
    evaluationFocus: ["context completeness", "audience specification", "technical clarity"],
    exampleGoodPrompt: "I'm documenting a REST API for our user management service. The endpoint is POST /api/users which creates a new user. It accepts JSON with name, email, and role fields. The documentation is for third-party developers integrating with our platform. Write clear, concise API documentation for this endpoint.",
  },

  // Hard challenges - advanced
  {
    id: "system-prompt-1",
    title: "System Design",
    scenario: "Write a system prompt for an AI assistant that helps with code review. It should be strict about security issues, helpful with suggestions, and always explain its reasoning.",
    technique: "System Prompts",
    difficulty: "hard",
    expectedLength: "long",
    evaluationFocus: ["behavioral constraints", "personality definition", "edge case handling"],
    exampleGoodPrompt: "You are a senior code reviewer with expertise in security. When reviewing code: 1) Always check for security vulnerabilities first and flag them as CRITICAL, 2) Provide constructive suggestions with examples, 3) Explain the reasoning behind each comment, 4) Be encouraging while maintaining high standards. If you're unsure about something, ask clarifying questions rather than making assumptions.",
  },
  {
    id: "constraint-handling-1",
    title: "Constraints",
    scenario: "Ask the AI to write a product description for a coffee maker. Add constraints: max 50 words, must mention the price ($49), and should appeal to busy professionals.",
    technique: "Constraint Specification",
    difficulty: "hard",
    expectedLength: "medium",
    evaluationFocus: ["constraint clarity", "completeness", "priority indication"],
    exampleGoodPrompt: "Write a product description for a coffee maker. Constraints: Maximum 50 words. Must mention the price: $49. Target audience: busy professionals who need quick morning coffee. Tone: professional but warm. Include one key feature that saves time.",
  },
  {
    id: "decomposition-1",
    title: "Task Breakdown",
    scenario: "You need help planning a small web app. Write a prompt that breaks down the task into specific sub-tasks the AI should address one by one.",
    technique: "Task Decomposition",
    difficulty: "hard",
    expectedLength: "long",
    evaluationFocus: ["task breakdown", "sequencing", "clarity of steps"],
    exampleGoodPrompt: "Help me plan a todo list web app. Please address these in order: 1) What core features should the MVP include? 2) What tech stack would you recommend and why? 3) What should the data model look like? 4) What are the main components needed? Provide your response organized by these sections.",
  },
];

// Get a random challenge
export function getRandomChallenge(): Challenge {
  return challenges[Math.floor(Math.random() * challenges.length)];
}

// Get challenge by difficulty
// Falls back to any challenge if no challenges match the requested difficulty
export function getChallengeByDifficulty(difficulty: "easy" | "medium" | "hard"): Challenge {
  const filtered = challenges.filter(c => c.difficulty === difficulty);
  // Defensive check: if no challenges match, fall back to any challenge
  // This shouldn't happen with current static data but prevents runtime errors
  if (filtered.length === 0) {
    console.warn(`No challenges found for difficulty "${difficulty}", falling back to random challenge`);
    return challenges[Math.floor(Math.random() * challenges.length)];
  }
  return filtered[Math.floor(Math.random() * filtered.length)];
}

// Get challenge by ID
export function getChallengeById(id: string): Challenge | undefined {
  return challenges.find(c => c.id === id);
}
