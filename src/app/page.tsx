"use client";

import { useChat } from "@ai-sdk/react";
import { MarkdownClient } from "@comark/react";
import breaks from "@comark/react/plugins/breaks";
import { DefaultChatTransport } from "ai";
import { SearchIcon, SendIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { MovieGrid, type MovieCardHit } from "@/components/movie-card";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

const transport = new DefaultChatTransport({ api: "/api/chat" });

/** Stable refs — MarkdownClient memoizes parse on content only. */
const markdownPlugins = [breaks()];
const markdownComponents = {
  img: () => null,
  movies: () => null,
};

type MovieHit = MovieCardHit;
type AssistantSegment =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "movies";
      ids: string[];
    };

function releaseYear(releaseDate: unknown) {
  if (typeof releaseDate !== "string" || releaseDate.length < 4) {
    return undefined;
  }
  const year = releaseDate.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : undefined;
}

function movieHits(output: unknown): MovieHit[] {
  if (!output || typeof output !== "object") return [];
  const hits = (output as { hits?: unknown }).hits;
  if (!Array.isArray(hits)) return [];

  return hits.flatMap((hit) => {
    if (!hit || typeof hit !== "object") return [];
    const {
      id,
      title,
      release_date: releaseDate,
      poster_path: posterPath,
    } = hit as {
      id?: unknown;
      title?: unknown;
      release_date?: unknown;
      poster_path?: unknown;
    };
    if (typeof title !== "string" || title.length === 0) return [];

    return [
      {
        id: typeof id === "string" || typeof id === "number" ? id : undefined,
        title,
        year: releaseYear(releaseDate),
        posterPath: typeof posterPath === "string" ? posterPath : undefined,
      },
    ];
  });
}

function unwrapMoviesCodeFence(text: string) {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:md|mdc|markdown)?\s*([\s\S]*?)\s*```$/i);
  if (!match) return text;
  return match[1].includes("::movies") ? match[1] : text;
}

function stripUnclosedMoviesBlock(text: string) {
  const openPattern = /(^|\n)[ \t]*::movies(?:\{[^}\n]*\})?[ \t]*\n/g;
  let lastOpenStart = -1;
  let match: RegExpExecArray | null = null;

  while ((match = openPattern.exec(text)) !== null) {
    lastOpenStart = match.index + (match[1]?.length ?? 0);
  }

  if (lastOpenStart === -1) return text;

  const tail = text.slice(lastOpenStart);
  const hasClose = /\n[ \t]*::(?=\n|$)/.test(tail);
  return hasClose ? text : text.slice(0, lastOpenStart).trimEnd();
}

function parseMovieIds(attributes: string | undefined) {
  if (!attributes) return [];

  const idsAttributeMatch = attributes.match(
    /:ids\s*=\s*(?:"([^"]*)"|'([^']*)')/,
  );
  const rawIds = idsAttributeMatch?.[1] ?? idsAttributeMatch?.[2];

  if (rawIds) {
    try {
      const parsed = JSON.parse(rawIds);
      if (Array.isArray(parsed)) {
        return parsed
          .map((id) => String(id).trim())
          .filter((id) => id.length > 0);
      }
    } catch {
      // Fall through to permissive parsing for malformed JSON.
    }

    return (rawIds.match(/[A-Za-z0-9_-]+/g) ?? []).filter(
      (id) => id.length > 0,
    );
  }

  const permissiveArray = attributes.match(/ids\s*=\s*\[([^\]]+)\]/);
  if (permissiveArray) {
    return permissiveArray[1]
      .split(",")
      .map((value) => value.trim().replace(/^['"]|['"]$/g, ""))
      .filter((id) => id.length > 0);
  }

  return attributes.match(/\d+/g) ?? [];
}

function splitAssistantText(text: string): AssistantSegment[] {
  const normalized = unwrapMoviesCodeFence(text);
  const blockPattern =
    /(^|\n)[ \t]*::movies(?:\{([^}]*)\})?[ \t]*\n[ \t]*::(?=\n|$)/g;
  const segments: AssistantSegment[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null = null;
  while ((match = blockPattern.exec(normalized)) !== null) {
    const prefixLength = match[1]?.length ?? 0;
    const blockStart = match.index + prefixLength;
    const before = normalized.slice(lastIndex, blockStart);

    if (before.length > 0) {
      segments.push({ type: "text", text: before });
    }

    segments.push({
      type: "movies",
      ids: parseMovieIds(match[2]),
    });

    lastIndex = blockPattern.lastIndex;
  }

  const tail = normalized.slice(lastIndex);
  if (tail.length > 0) {
    segments.push({ type: "text", text: tail });
  }

  return segments.length > 0 ? segments : [{ type: "text", text: normalized }];
}

function resolveMovies(ids: string[], moviesById: Map<string, MovieHit>) {
  const movies: MovieHit[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    const key = String(id);
    if (seen.has(key)) continue;

    const movie = moviesById.get(key);
    if (!movie) continue;

    seen.add(key);
    movies.push(movie);
  }

  return movies;
}

function toolQuery(input: unknown) {
  if (!input || typeof input !== "object") return undefined;
  const q = (input as { q?: unknown }).q;
  return typeof q === "string" && q.length > 0 ? q : undefined;
}

function toolDocumentId(input: unknown) {
  if (!input || typeof input !== "object") return undefined;
  const id = (input as { id?: unknown }).id;
  if (typeof id === "string" && id.length > 0) return id;
  if (typeof id === "number") return String(id);
  return undefined;
}

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

function SearchMoviesMarker({
  summary,
}: {
  summary: string;
}) {
  return (
    <Marker role="status">
      <MarkerIcon>
        <SearchIcon />
      </MarkerIcon>
      <MarkerContent>{summary}</MarkerContent>
    </Marker>
  );
}

export default function Home() {
  const { messages, sendMessage, status } = useChat({ transport });
  const [input, setInput] = useState("");
  const moviesById = new Map<string, MovieHit>();

  for (const message of messages) {
    for (const part of message.parts) {
      const searchablePart =
        part.type === "tool-searchMovies" ||
        part.type === "tool-searchSimilarMovies";
      if (!searchablePart || part.state !== "output-available") continue;

      const hits = movieHits(part.output);
      for (const hit of hits) {
        if (hit.id == null) continue;
        const key = String(hit.id);
        if (!moviesById.has(key)) moviesById.set(key, hit);
      }
    }
  }

  const ready = status === "ready";
  const generating = status === "submitted" || status === "streaming";

  const lastMessage = messages[messages.length - 1];
  const lastAssistantHasText =
    lastMessage?.role === "assistant" &&
    lastMessage.parts.some(
      (part) => part.type === "text" && part.text.trim().length > 0,
    );
  const showThinking = generating && !lastAssistantHasText;

  function send() {
    const text = input.trim();
    if (!text || !ready) return;

    sendMessage({ text });
    setInput("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    send();
  }

  return (
    <div className="flex h-svh w-full flex-col">
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto w-full max-w-xl gap-4 p-4">
              {messages.map((message, messageIndex) => {
                const streaming =
                  status === "streaming" &&
                  message.role === "assistant" &&
                  messageIndex === messages.length - 1;
                const isUser = message.role === "user";

                return (
                  <MessageScrollerItem key={message.id} messageId={message.id}>
                    <Message align={isUser ? "end" : "start"}>
                      <MessageContent>
                        {isUser ? (
                          <Bubble variant="default" align="end">
                            <BubbleContent>
                              {message.parts.map((part, index) => {
                                if (part.type !== "text") return null;

                                return (
                                  <span
                                    key={index}
                                    className="whitespace-pre-wrap"
                                  >
                                    {part.text}
                                  </span>
                                );
                              })}
                            </BubbleContent>
                          </Bubble>
                        ) : (
                          message.parts.map((part, index) => {
                            if (part.type === "text") {
                              const stableText = streaming
                                ? stripUnclosedMoviesBlock(part.text)
                                : part.text;
                              const segments = splitAssistantText(stableText);
                              const renderedSegments = segments.flatMap(
                                (segment, segmentIndex) => {
                                  if (segment.type === "movies") {
                                    const movies = resolveMovies(
                                      segment.ids,
                                      moviesById,
                                    );
                                    if (movies.length === 0) return [];
                                    return [
                                      <MovieGrid
                                        key={`${index}-movies-${segmentIndex}`}
                                        movies={movies}
                                      />,
                                    ];
                                  }

                                  if (!segment.text.trim()) return [];

                                  return [
                                    <Bubble
                                      key={`${index}-text-${segmentIndex}`}
                                      variant="secondary"
                                      align="start"
                                    >
                                      <BubbleContent>
                                        <MarkdownClient
                                          value={segment.text}
                                          plugins={markdownPlugins}
                                          components={markdownComponents}
                                          streaming={
                                            streaming &&
                                            segmentIndex === segments.length - 1
                                          }
                                          className="[&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                                        />
                                      </BubbleContent>
                                    </Bubble>,
                                  ];
                                },
                              );

                              if (renderedSegments.length === 0) return null;

                              return (
                                <div
                                  key={index}
                                  className="flex w-full min-w-0 flex-col gap-2"
                                >
                                  {renderedSegments}
                                </div>
                              );
                            }

                            if (part.type === "tool-searchMovies") {
                              const q = toolQuery(part.input);
                              const callId = part.toolCallId;

                              if (part.state === "output-available") {
                                const count = movieHits(part.output).length;
                                return (
                                  <SearchMoviesMarker
                                    key={callId}
                                    summary={`${count} ${pluralize(count, "result", "results")} found${q ? ` for \u201c${q}\u201d` : ""}`}
                                  />
                                );
                              }

                              if (part.state === "output-error") {
                                return (
                                  <Marker key={callId} role="status">
                                    <MarkerIcon>
                                      <SearchIcon />
                                    </MarkerIcon>
                                    <MarkerContent>
                                      Search failed
                                      {q ? ` for \u201c${q}\u201d` : ""}
                                    </MarkerContent>
                                  </Marker>
                                );
                              }

                              return (
                                <Marker key={callId} role="status">
                                  <MarkerIcon>
                                    <SearchIcon />
                                  </MarkerIcon>
                                  <MarkerContent className="shimmer">
                                    {q
                                      ? `Searching for \u201c${q}\u201d...`
                                      : "Searching..."}
                                  </MarkerContent>
                                </Marker>
                              );
                            }

                            if (part.type === "tool-searchSimilarMovies") {
                              const id = toolDocumentId(part.input);
                              const callId = part.toolCallId;
                              const movieTitle = id
                                ? moviesById.get(id)?.title
                                : undefined;

                              if (part.state === "output-available") {
                                const count = movieHits(part.output).length;
                                const reference = movieTitle
                                  ? `\u201c${movieTitle}\u201d`
                                  : id
                                    ? `movie ID ${id}`
                                    : "the selected movie";
                                return (
                                  <SearchMoviesMarker
                                    key={callId}
                                    summary={`${count} ${pluralize(count, "result", "results")} similar to ${reference}`}
                                  />
                                );
                              }

                              if (part.state === "output-error") {
                                return (
                                  <Marker key={callId} role="status">
                                    <MarkerIcon>
                                      <SearchIcon />
                                    </MarkerIcon>
                                    <MarkerContent>
                                      Similar search failed
                                      {movieTitle
                                        ? ` for \u201c${movieTitle}\u201d`
                                        : id
                                          ? ` for movie ID ${id}`
                                          : ""}
                                    </MarkerContent>
                                  </Marker>
                                );
                              }

                              return (
                                <Marker key={callId} role="status">
                                  <MarkerIcon>
                                    <SearchIcon />
                                  </MarkerIcon>
                                  <MarkerContent className="shimmer">
                                    {movieTitle
                                      ? `Finding movies similar to \u201c${movieTitle}\u201d...`
                                      : id
                                        ? `Finding movies similar to movie ID ${id}...`
                                        : "Finding similar movies..."}
                                  </MarkerContent>
                                </Marker>
                              );
                            }

                            return null;
                          })
                        )}
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                );
              })}

              {showThinking ? (
                <Marker role="status">
                  <MarkerIcon>
                    <Spinner />
                  </MarkerIcon>
                  <MarkerContent className="shimmer">Thinking...</MarkerContent>
                </Marker>
              ) : null}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="mx-auto w-full max-w-xl shrink-0 px-4 pb-4">
        <form
          className="border-border bg-background flex items-end gap-2 rounded-3xl border p-2 shadow-sm"
          onSubmit={handleSubmit}
        >
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about movies..."
            rows={1}
            disabled={!ready}
            className="max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent px-3 py-2 shadow-none focus-visible:border-transparent focus-visible:ring-0 disabled:bg-transparent dark:bg-transparent"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="size-9 shrink-0 rounded-full"
            disabled={!ready || !input.trim()}
          >
            <SendIcon />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
