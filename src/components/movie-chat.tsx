"use client";

import { useChat } from "@ai-sdk/react";
import { MarkdownClient } from "@comark/react";
import breaks from "@comark/react/plugins/breaks";
import { DefaultChatTransport } from "ai";
import { ChevronDownIcon, SearchIcon, SendIcon } from "lucide-react";
import { useState, type FormEvent, type AnchorHTMLAttributes, type TableHTMLAttributes } from "react";

import { HomeEmptyState } from "@/components/category-grid";
import { MovieGrid, type MovieCardHit } from "@/components/movie-card";
import type { CategoryCard } from "@/lib/categories";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
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

const markdownClassName = cn(
  // Block rhythm
  "[&_p]:mb-3 [&_p:last-child]:mb-0",
  "[&_p]:whitespace-pre-wrap [&_li]:whitespace-pre-wrap",
  "[&_ol]:mb-3 [&_ol:last-child]:mb-0 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_ul]:mb-3 [&_ul:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ul.contains-task-list]:list-none [&_ul.contains-task-list]:pl-0",
  "[&_li.task-list-item]:flex [&_li.task-list-item]:items-start [&_li.task-list-item]:gap-2",
  "[&_li.task-list-item_input]:mt-1",
  // Headings (scaled for chat bubbles)
  "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h1:first-child]:mt-0",
  "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2:first-child]:mt-0",
  "[&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3:first-child]:mt-0",
  "[&_h4]:mt-3 [&_h4]:mb-1.5 [&_h4]:text-sm [&_h4]:font-medium [&_h4:first-child]:mt-0",
  "[&_h5]:mt-3 [&_h5]:mb-1.5 [&_h5]:text-sm [&_h5]:font-medium [&_h5:first-child]:mt-0",
  "[&_h6]:mt-3 [&_h6]:mb-1.5 [&_h6]:text-sm [&_h6]:font-medium [&_h6:first-child]:mt-0",
  // Inline
  "[&_a]:font-medium [&_a]:underline [&_a]:underline-offset-3",
  "[&_del]:text-muted-foreground [&_del]:line-through",
  "[&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
  "[&_pre_code]:rounded-none [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[0.85em]",
  // Blocks
  "[&_blockquote]:mb-3 [&_blockquote:last-child]:mb-0 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_pre]:mb-3 [&_pre:last-child]:mb-0 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-[0.85em]",
  "[&_hr]:my-4 [&_hr]:border-border",
  // Tables (margin handled by MarkdownTable wrapper)
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-left",
  "[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1.5 [&_th]:font-medium",
  "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5",
);

function MarkdownLink({
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const isExternal =
    typeof href === "string" && /^(https?:|mailto:|tel:)/i.test(href);

  return (
    <a
      href={href}
      {...props}
      {...(isExternal
        ? { target: "_blank", rel: "noopener noreferrer" }
        : undefined)}
    >
      {children}
    </a>
  );
}

function MarkdownTable({
  children,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="mb-3 w-full max-w-full overflow-x-auto last:mb-0">
      <table {...props}>{children}</table>
    </div>
  );
}

const markdownComponents = {
  img: () => null,
  movies: () => null,
  a: MarkdownLink,
  table: MarkdownTable,
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
  hits,
}: {
  summary: string;
  hits: MovieHit[];
}) {
  return (
    <Collapsible className="group w-full">
      <div className="flex items-center gap-1">
        <Marker role="status" className="min-w-0 flex-1">
          <MarkerIcon>
            <SearchIcon />
          </MarkerIcon>
          <MarkerContent>{summary}</MarkerContent>
        </Marker>
        {hits.length > 0 ? (
          <CollapsibleTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground"
              />
            }
          >
            <ChevronDownIcon className="transition-transform duration-200 group-data-open:rotate-180" />
            <span className="sr-only">Show search results</span>
          </CollapsibleTrigger>
        ) : null}
      </div>
      <CollapsibleContent className="mt-1.5 overflow-hidden">
        <Card
          size="sm"
          className="bg-muted/40 text-muted-foreground ring-foreground/5"
        >
          <CardContent>
            <ol className="list-decimal pl-5">
              {hits.map((hit, i) => (
                <li key={hit.id ?? `${hit.title}-${i}`}>
                  {hit.year ? `${hit.title}, ${hit.year}` : hit.title}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function MovieChat({ categories }: { categories: CategoryCard[] }) {
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

  const empty = messages.length === 0;
  const ready = status === "ready";
  const generating = status === "submitted" || status === "streaming";

  const lastMessage = messages[messages.length - 1];
  const lastAssistantHasText =
    lastMessage?.role === "assistant" &&
    lastMessage.parts.some(
      (part) => part.type === "text" && part.text.trim().length > 0,
    );
  const showThinking = generating && !lastAssistantHasText;

  function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !ready) return;

    sendMessage({ text: trimmed });
  }

  function send() {
    const text = input.trim();
    if (!text || !ready) return;

    sendText(text);
    setInput("");
  }

  function selectGenre(genre: string) {
    sendText(`I want to watch ${genre} movies`);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    send();
  }

  return (
    <div className="flex h-svh w-full flex-col">
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport className="@container overflow-x-hidden">
            <MessageScrollerContent
              className={cn(
                "mx-auto w-full gap-4 p-4",
                empty ? "max-w-5xl justify-center" : "max-w-xl",
              )}
            >
              {empty ? (
                <HomeEmptyState
                  categories={categories}
                  disabled={!ready}
                  onSelect={selectGenre}
                />
              ) : (
                messages.map((message, messageIndex) => {
                  const streaming =
                    status === "streaming" &&
                    message.role === "assistant" &&
                    messageIndex === messages.length - 1;
                  const isUser = message.role === "user";

                  return (
                    <MessageScrollerItem
                      key={message.id}
                      messageId={message.id}
                    >
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
                                              segmentIndex ===
                                                segments.length - 1
                                            }
                                            className={markdownClassName}
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
                                  const hits = movieHits(part.output);
                                  const count = hits.length;
                                  return (
                                    <SearchMoviesMarker
                                      key={callId}
                                      hits={hits}
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
                                  const hits = movieHits(part.output);
                                  const count = hits.length;
                                  const reference = movieTitle
                                    ? `\u201c${movieTitle}\u201d`
                                    : id
                                      ? `movie ID ${id}`
                                      : "the selected movie";
                                  return (
                                    <SearchMoviesMarker
                                      key={callId}
                                      hits={hits}
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
                })
              )}

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
