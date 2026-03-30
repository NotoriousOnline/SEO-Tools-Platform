import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

/**
 * Calls Claude with a system prompt and user message.
 * SERVER-SIDE ONLY — import only from /app/api/
 */
export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  options?: { maxTokens?: number }
): Promise<string> {
  const max_tokens = options?.maxTokens ?? 2048;
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const firstBlock = response.content[0];
  if (firstBlock?.type === "text") {
    return firstBlock.text;
  }
  return "";
}
