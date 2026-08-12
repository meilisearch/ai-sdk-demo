"use client";

import { useChat } from "@ai-sdk/react";
import { MarkdownClient } from "@comark/react";
import breaks from "@comark/react/plugins/breaks";
import { DefaultChatTransport } from "ai";
import { ChevronDownIcon, SearchIcon, SendIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

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
import { cn } from "@/lib/utils";

const transport = new DefaultChatTransport({ api: "/api/chat" });

/** Stable refs — MarkdownClient memoizes parse on content only. */
const markdownPlugins = [breaks()];
const markdownComponents = {
  img: () => null,
};

type MovieHit = {
  id?: string | number;
  title: string;
  year?: string;
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
    } = hit as {
      id?: unknown;
      title?: unknown;
      release_date?: unknown;
    };
    if (typeof title !== "string" || title.length === 0) return [];

    return [
      {
        id: typeof id === "string" || typeof id === "number" ? id : undefined,
        title,
        year: releaseYear(releaseDate),
      },
    ];
  });
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
  output,
}: {
  summary: (count: number) => string;
  output: unknown;
}) {
  const [open, setOpen] = useState(false);
  const hits = movieHits(output);

  return (
    <div className="w-full min-w-0">
      <Marker
        render={
          <button
            type="button"
            className="cursor-pointer p-0"
            onClick={() => setOpen((value) => !value)}
          />
        }
        aria-expanded={open}
      >
        <MarkerIcon>
          <SearchIcon />
        </MarkerIcon>
        <MarkerContent>{summary(hits.length)}</MarkerContent>
        <ChevronDownIcon
          className={cn(
            "ml-auto size-4 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </Marker>
      {open ? (
        <ol className="border-border/60 text-muted-foreground mt-1 w-full min-w-0 space-y-0.5 rounded-md border p-2 text-xs leading-snug">
          {hits.map((hit, index) => (
            <li key={hit.id ?? hit.title} className="flex min-w-0 gap-2">
              <span className="w-6 shrink-0 text-right whitespace-nowrap tabular-nums">
                {index + 1}.
              </span>
              <span className="min-w-0 truncate">
                <span className="font-medium">{hit.title}</span>
                {hit.year ? `, ${hit.year}` : null}
                {hit.id != null ? (
                  <>
                    {" "}
                    <code className="bg-muted rounded px-1 py-px font-mono text-[0.65rem]">
                      ID {hit.id}
                    </code>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

export default function Home() {
  const { messages, sendMessage, status } = useChat({ transport });
  const [input, setInput] = useState("");
  const movieTitlesById = new Map<string, string>();

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
        if (!movieTitlesById.has(key)) movieTitlesById.set(key, hit.title);
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
                              if (!part.text.trim()) return null;

                              return (
                                <Bubble
                                  key={index}
                                  variant="secondary"
                                  align="start"
                                >
                                  <BubbleContent>
                                    <MarkdownClient
                                      value={part.text}
                                      plugins={markdownPlugins}
                                      components={markdownComponents}
                                      streaming={streaming}
                                      className="[&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                                    />
                                  </BubbleContent>
                                </Bubble>
                              );
                            }

                            if (part.type === "tool-searchMovies") {
                              const q = toolQuery(part.input);
                              const callId = part.toolCallId;

                              if (part.state === "output-available") {
                                return (
                                  <SearchMoviesMarker
                                    key={callId}
                                    summary={(count) =>
                                      `${count} ${pluralize(count, "result", "results")} found${q ? ` for \u201c${q}\u201d` : ""}`
                                    }
                                    output={part.output}
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
                                ? movieTitlesById.get(id)
                                : undefined;

                              if (part.state === "output-available") {
                                const reference = movieTitle
                                  ? `\u201c${movieTitle}\u201d`
                                  : id
                                    ? `movie ID ${id}`
                                    : "the selected movie";
                                return (
                                  <SearchMoviesMarker
                                    key={callId}
                                    summary={(count) =>
                                      `${count} ${pluralize(count, "result", "results")} similar to ${reference}`
                                    }
                                    output={part.output}
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
