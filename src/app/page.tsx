"use client";

import { useState, type FormEvent } from "react";
import { SendIcon } from "lucide-react";

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

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const initialMessages: ChatMessage[] = [
  {
    id: "1",
    role: "assistant",
    content: "Hi! How can I help you today?",
  },
  {
    id: "2",
    role: "user",
    content: "Tell me about Meilisearch.",
  },
];

export default function Home() {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");

  function send() {
    const text = input.trim();
    if (!text) return;

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: text },
    ]);
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
              {messages.map((message) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.role === "user"}
                >
                  <Message align={message.role === "user" ? "end" : "start"}>
                    <MessageContent>{message.content}</MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      <form className="flex gap-2 p-4" onSubmit={handleSubmit}>
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type a message..."
          rows={1}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <Button type="submit" size="icon" disabled={!input.trim()}>
          <SendIcon />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
