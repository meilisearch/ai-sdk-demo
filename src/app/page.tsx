"use client";

import { useChat } from "@ai-sdk/react";
import { MarkdownClient } from "@comark/react";
import breaks from "@comark/react/plugins/breaks";
import { DefaultChatTransport } from "ai";
import { SendIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
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
};

export default function Home() {
  const { messages, sendMessage, status } = useChat({ transport });
  const [input, setInput] = useState("");

  const ready = status === "ready";
  const generating = status === "submitted" || status === "streaming";

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
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={isUser}
                  >
                    <Message align={isUser ? "end" : "start"}>
                      <MessageContent>
                        <Bubble
                          variant={isUser ? "default" : "secondary"}
                          align={isUser ? "end" : "start"}
                        >
                          <BubbleContent>
                            {message.parts.map((part, index) => {
                              if (part.type !== "text") return null;

                              if (isUser) {
                                return (
                                  <span
                                    key={index}
                                    className="whitespace-pre-wrap"
                                  >
                                    {part.text}
                                  </span>
                                );
                              }

                              return (
                                <MarkdownClient
                                  key={index}
                                  value={part.text}
                                  plugins={markdownPlugins}
                                  components={markdownComponents}
                                  streaming={streaming}
                                  className="[&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                                />
                              );
                            })}
                          </BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                );
              })}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="mx-auto w-full max-w-xl shrink-0 px-4 pb-4">
        <form
          className="flex items-end gap-2 rounded-3xl border border-border bg-background p-2 shadow-sm"
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
          {generating ? (
            <div
              className="flex size-9 shrink-0 items-center justify-center"
              aria-live="polite"
            >
              <Spinner />
              <span className="sr-only">Generating</span>
            </div>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="size-9 shrink-0 rounded-full"
              disabled={!ready || !input.trim()}
            >
              <SendIcon />
              <span className="sr-only">Send</span>
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
