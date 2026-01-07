// Prompt engineering educational excerpts - every keystroke teaches
const excerpts = [
  // Fundamentals
  "Large language models predict the most likely next token. Your prompt sets the trajectory. Clear instructions lead to clear outputs. Vague prompts produce vague responses. The quality of your input directly determines the quality of output.",

  "Zero-shot prompting works without examples. Just describe what you want clearly. The model uses its training to understand your intent. Be specific about the task, the format, and any constraints you need the model to follow.",

  "Few-shot prompting teaches through examples. Show the model what you want by demonstrating the pattern. Two or three examples establish the expected input-output format. The model learns your desired structure from the patterns you provide.",

  // Techniques
  "Chain of thought prompting asks the model to think step by step. Breaking complex problems into smaller steps improves accuracy. Add 'Let's think through this step by step' to unlock better reasoning on difficult tasks.",

  "System prompts define the AI's behavior for an entire conversation. Set the role, constraints, and output format upfront. A good system prompt is like giving instructions to a new team member before they start working.",

  "Role prompting assigns an identity to shape responses. 'Act as an expert Python developer' changes vocabulary and depth. The persona you assign influences tone, expertise level, and communication style throughout the conversation.",

  // Best Practices
  "Use positive instructions instead of negative constraints. 'Write three paragraphs' works better than 'don't write too much.' Tell the model what to do, not what to avoid. Positive guidance creates clearer direction.",

  "Specify the exact output format you need. Request JSON, bullet points, or numbered lists explicitly. Structure your prompt to match your desired response structure. Ambiguous format requests lead to inconsistent outputs.",

  "Temperature controls randomness in outputs. Zero gives deterministic responses for factual tasks. Higher values add creativity and variation. Choose based on whether you need consistency or creative diversity.",

  // Advanced
  "The ReAct pattern combines reasoning with action. Think, then act, then observe results. This loop enables complex tasks requiring external information. The model can plan, execute, and adapt based on feedback.",

  "Self-consistency generates multiple reasoning paths and selects the most common answer. When one attempt might fail, several attempts with majority voting increase reliability and catch errors in complex reasoning.",

  "Context is everything in prompt engineering. Provide relevant background information upfront. Specify the target audience. Include constraints and requirements. More context leads to more tailored and accurate responses.",

  // Code-specific
  "When prompting for code, specify the language explicitly. Describe the function signature and expected behavior. Include edge cases to handle. Request error handling and type hints. Clear requirements produce production-ready code.",

  "Debugging prompts should include the error message, expected behavior, and relevant code context. Describe what you tried. Ask for both the fix and an explanation. Good debugging prompts lead to understanding, not just solutions.",

  // Meta
  "Prompt engineering is iterative. Start simple, test with diverse inputs, and refine based on results. Document what works. Each improvement builds on the last. The best prompts emerge through experimentation and careful observation.",
];

// Categorized excerpts for targeted practice
export const excerptCategories = {
  fundamentals: excerpts.slice(0, 3),
  techniques: excerpts.slice(3, 6),
  bestPractices: excerpts.slice(6, 9),
  advanced: excerpts.slice(9, 12),
  code: excerpts.slice(12, 14),
  meta: excerpts.slice(14),
};

export function getRandomExcerpt() {
  return excerpts[Math.floor(Math.random() * excerpts.length)];
}

export { excerpts };

