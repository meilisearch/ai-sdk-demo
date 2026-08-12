import {
  meilisearchSearch,
  meilisearchSearchSimilar,
} from "@meilisearch/ai-sdk";
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

const meilisearch = {
  host: process.env.MEILISEARCH_HOST!,
  apiKey: process.env.MEILISEARCH_API_KEY,
  indexUid: process.env.MEILISEARCH_INDEX!,
};

const tools = {
  searchMovies: meilisearchSearch({
    ...meilisearch,
    description: "Search movies by title or description",
    searchParams: {
      hybrid: {
        embedder: "small",
        semanticRatio: 0.5,
      },
    },
  }),
  searchSimilarMovies: meilisearchSearchSimilar({
    ...meilisearch,
    description: "Find similar movies by document ID",
    searchSimilarParams: {
      embedder: "small",
      limit: 10,
    },
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
    system: `
      You are a movie assistant. Your task is to recommend streaming platforms to watch movies.

      Always use your tools to search movies and find streaming platforms to watch them.
      Use searchSimilarMovies with a movie document ID when the user asks for similar movies.

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
        console.error(
          `[chat] tool ${toolCall.toolName} error`,
          toolOutput.error,
        );
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
