"use client";

import { useChat } from "@ai-sdk/react";
import { MarkdownClient } from "@comark/react";
import breaks from "@comark/react/plugins/breaks";
import { DefaultChatTransport } from "ai";
import { SendIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

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
    <div className="mx-auto flex h-svh w-full max-w-xl flex-col">
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="p-4">
              {messages.map((message, messageIndex) => {
                const streaming =
                  status === "streaming" &&
                  message.role === "assistant" &&
                  messageIndex === messages.length - 1;

                return (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={message.role === "user"}
                  >
                    <Message align={message.role === "user" ? "end" : "start"}>
                      <MessageContent>
                        {message.parts.map((part, index) => {
                          if (part.type !== "text") return null;

                          if (message.role === "user") {
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
      <form className="flex gap-2 p-4" onSubmit={handleSubmit}>
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about movies..."
          rows={1}
          disabled={!ready}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <Button type="submit" size="icon" disabled={!ready || !input.trim()}>
          <SendIcon />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
