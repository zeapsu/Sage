"use client";

import { useState, useRef, useEffect } from "react";

// --- Types ---

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ChatWidgetProps {
  tomeName?: string;
  providerName?: string;
  messages?: ChatMessage[];
  onSend?: (message: string) => void;
  isLoading?: boolean;
}

// --- Sample conversation ---

export const SAMPLE_MESSAGES: ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    content: "What is the key difference between self-attention and cross-attention?",
    timestamp: "2:30 PM",
  },
  {
    id: "m2",
    role: "assistant",
    content: "Great question! The key difference lies in **where the queries, keys, and values come from**:\n\n**Self-attention:** Q, K, and V all come from the *same* sequence. Each token attends to every other token in the same input — the model is essentially asking \"which other parts of this input are relevant to me?\"\n\n**Cross-attention:** Q comes from one sequence (e.g., the decoder), while K and V come from a *different* sequence (e.g., the encoder output). This lets one sequence \"look at\" another — essential for tasks like translation where the output needs to attend to the input.\n\nThink of it this way:\n- Self-attention: reading a book and highlighting relevant passages\n- Cross-attention: writing a summary while referencing the original text",
    timestamp: "2:30 PM",
  },
  {
    id: "m3",
    role: "user",
    content: "Can you give me a concrete example of where cross-attention is used?",
    timestamp: "2:31 PM",
  },
  {
    id: "m4",
    role: "assistant",
    content: "Absolutely! The most classic example is **machine translation**:\n\nImagine translating \"The cat sat on the mat\" from English to French.\n\n1. The **encoder** processes the English sentence and produces hidden states for each word\n2. The **decoder** generates French words one at a time: \"Le\", \"chat\", \"s'est\", ...\n3. At each decoder step, **cross-attention** lets the decoder attend to the encoder's output — \"which English words should I focus on right now?\"\n\nWhen generating \"chat\", the cross-attention would strongly attend to the encoder state for \"cat\". When generating \"tapis\" (mat), it attends to \"mat\".\n\nOther common uses:\n- **Image captioning:** text decoder attends to CNN/ViT visual features\n- **Retrieval-Augmented Generation:** model attends to retrieved documents\n- **Stable Diffusion:** the U-Net uses cross-attention to attend to the text embedding",
    timestamp: "2:31 PM",
  },
];

// --- Component ---

export default function ChatWidget({
  tomeName = "Deep Learning Foundations",
  providerName = "GPT-4o",
  messages: initialMessages = SAMPLE_MESSAGES,
  onSend,
  isLoading = false,
}: ChatWidgetProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    onSend?.(text);

    // Simulate assistant response for prototyping
    setTimeout(() => {
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: `I received your message: "${text}". In the real app, the agent would process this using the ${tomeName} tome and ${providerName}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-full max-w-[640px] px-4">
      <div
        className="bg-surface/80 backdrop-blur-[32px] border border-outline-variant/15
                   rounded-2xl overflow-hidden flex flex-col
                   shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(173,198,255,0.04)]"
        style={{ height: "520px" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant/10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">chat_bubble</span>
            <h2 className="text-title-md font-medium text-on-surface">Chat</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-surface-container-low rounded-full px-2.5 py-1 border border-outline-variant/10">
              <span className="material-symbols-outlined text-on-surface-variant text-sm">auto_stories</span>
              <span className="text-label-sm text-on-surface-variant truncate max-w-[140px]">{tomeName}</span>
            </div>
            <div className="flex items-center gap-1 bg-surface-container-high rounded-full px-2.5 py-1 border border-outline-variant/10">
              <span className="text-label-sm text-primary leading-none">⚡</span>
              <span className="text-label-sm text-on-surface-variant uppercase leading-none">{providerName}</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary/15 border border-primary/20 text-on-surface"
                    : "bg-surface-container-low border border-outline-variant/10 text-on-surface-variant"
                }`}
              >
                <div className="text-body-md leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                <div className={`text-label-sm mt-1.5 ${msg.role === "user" ? "text-primary/50" : "text-on-surface-variant/40"}`}>
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-on-surface-variant/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-on-surface-variant/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-on-surface-variant/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-outline-variant/10">
          <div className="flex items-end gap-2 bg-surface-container-low border border-outline-variant/10 rounded-xl p-3 focus-within:border-primary/30 transition-colors duration-150">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your knowledge base..."
              rows={1}
              className="flex-1 bg-transparent text-body-md text-on-surface placeholder:text-on-surface-variant/50
                         resize-none outline-none leading-relaxed max-h-24"
              style={{ minHeight: "24px" }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30
                         flex items-center justify-center flex-shrink-0
                         text-primary hover:bg-primary/30
                         disabled:opacity-30 disabled:cursor-not-allowed
                         transition-all duration-150"
            >
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                send
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
