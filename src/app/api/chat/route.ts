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

const modelId = process.env.OPENROUTER_MODEL!;

const tools = {
  searchMovies: meilisearchSearch({
    host: process.env.MEILISEARCH_HOST!,
    apiKey: process.env.MEILISEARCH_API_KEY,
    indexUid: process.env.MEILISEARCH_INDEX!,
    description: "Search movies by title or description",
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
    system:`
      You are a movie assistant. Your task is to recommend streaming platforms to watch movies.

      Always use your tools to search movies and find streaming platforms to watch them.

      Only offer follow-up actions that match your tools capabilities. Do not offer any follow-up actions unless they make sense.
      `,
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
