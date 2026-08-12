import { meilisearchSearch } from "@meilisearch/ai-sdk";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";

export const maxDuration = 30;

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const modelId = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

const tools = {
  search: meilisearchSearch({
    host: process.env.MEILISEARCH_HOST!,
    apiKey: process.env.MEILISEARCH_API_KEY,
    indexUid: process.env.MEILISEARCH_INDEX ?? "movies",
    description: "Search movies by title or synopsis",
  }),
};

function hitCount(output: unknown) {
  if (!output || typeof output !== "object") return 0;
  const hits = (output as { hits?: unknown }).hits;
  return Array.isArray(hits) ? hits.length : 0;
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openrouter.chat(modelId),
    system:
      "You are a movie assistant. Use the search tool to find films by title or synopsis, then recommend and summarize what you find. Format replies with clear Markdown: use blank lines between paragraphs, numbered or bulleted lists on their own lines, and **bold** for titles.",
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
    onToolExecutionStart({ toolCall }) {
      console.info(`[chat] tool ${toolCall.toolName}`, toolCall.input);
    },
    onToolExecutionEnd({ toolCall, toolOutput }) {
      if (toolOutput.type === "tool-error") {
        console.error(`[chat] tool ${toolCall.toolName} error`, toolOutput.error);
        return;
      }

      console.info(
        `[chat] tool ${toolCall.toolName} → ${hitCount(toolOutput.output)} responses`,
      );
    },
    onStepEnd({ text }) {
      if (text.trim()) console.info("[chat] assistant:", text);
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
