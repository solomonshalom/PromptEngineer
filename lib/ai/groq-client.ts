// Groq API client for prompt evaluation
// Using Groq with openai/gpt-oss-120b model

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const FETCH_TIMEOUT_MS = 30000; // 30 second timeout for AI requests

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
}

export interface GroqResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class AIClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: unknown
  ) {
    super(message);
    this.name = "AIClientError";
  }
}

export async function callAI(
  messages: ChatMessage[],
  options: CompletionOptions = {}
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new AIClientError("GROQ_API_KEY environment variable is not set");
  }

  const {
    model = "openai/gpt-oss-120b",
    temperature = 0,
    max_tokens = 2048,
    response_format
  } = options;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens,
  };

  if (response_format) {
    body.response_format = response_format;
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new AIClientError(`Groq API request timed out after ${FETCH_TIMEOUT_MS / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }
    throw new AIClientError(
      `Groq API error: ${response.status} ${response.statusText}`,
      response.status,
      errorBody
    );
  }

  const data = (await response.json()) as GroqResponse;

  if (!data.choices?.[0]?.message?.content) {
    throw new AIClientError("Invalid response from Groq API: no content in response");
  }

  return data.choices[0].message.content;
}

// Helper for JSON responses with retry on parse failure
export async function callAIJSON<T>(
  messages: ChatMessage[],
  options: Omit<CompletionOptions, "response_format"> = {}
): Promise<T> {
  const content = await callAI(messages, {
    ...options,
    response_format: { type: "json_object" },
  });

  try {
    return JSON.parse(content) as T;
  } catch (error) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]) as T;
      } catch {
        // Fall through to error
      }
    }

    throw new AIClientError(
      `Failed to parse AI response as JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
      undefined,
      content
    );
  }
}
