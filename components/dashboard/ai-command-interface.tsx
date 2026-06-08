"use client";

import { useCallback, useRef, useState } from "react";
import { getSuggestedActions } from "@/lib/i18n/data";
import { getDateLocale, useDictionary, useLocale, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ArrowUp, Crown, Loader2 } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "ceo";
  content: string;
  timestamp: string;
}

export function AiCommandInterface() {
  const locale = useLocale();
  const t = useT();
  const { platform } = useDictionary();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const formatTimestamp = useCallback(
    (iso: string) =>
      new Date(iso).toLocaleTimeString(getDateLocale(locale), {
        hour: "numeric",
        minute: "2-digit",
      }),
    [locale],
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setError(null);
      setIsLoading(true);

      try {
        const res = await fetch("/api/ceo/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data.error ?? t("dashboard.command.errors.reachCeo"),
          );
        }

        const ceoMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "ceo",
          content: data.response,
          timestamp: data.timestamp ?? new Date().toISOString(),
        };

        setMessages((prev) => [...prev, ceoMessage]);
        setTimeout(scrollToBottom, 50);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("dashboard.command.errors.generic"),
        );
      } finally {
        setIsLoading(false);
        textareaRef.current?.focus();
      }
    },
    [isLoading, scrollToBottom, t],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const hasMessages = messages.length > 0;
  const suggestedActions = getSuggestedActions(locale);

  const suggestedQuestions = [
    t("dashboard.command.suggestedQuestions.whatIsOurMission"),
    t("dashboard.command.suggestedQuestions.brandValues"),
    t("dashboard.command.suggestedQuestions.targetAudience"),
    ...suggestedActions.map((a) => a.label),
  ];

  return (
    <section className="relative py-8">
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2"
        aria-hidden
      >
        <div className="mx-auto h-[400px] max-w-4xl rounded-full bg-primary/[0.06] blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-4xl">
        <div className="command-interface overflow-hidden px-10 py-14 sm:px-14 sm:py-16 lg:px-20 lg:py-20">
          <p className="text-label mb-8 text-primary/80">
            {platform.commandCenterName}
          </p>

          {!hasMessages ? (
            <h2 className="command-interface-headline mb-12 max-w-3xl">
              {t("dashboard.command.headline")}
            </h2>
          ) : (
            <div className="mb-8 max-h-[420px] space-y-6 overflow-y-auto pr-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-4",
                    msg.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  {msg.role === "ceo" && (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Crown className="size-4" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-5 py-4",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-background/60",
                    )}
                  >
                    {msg.role === "ceo" && (
                      <p className="mb-1.5 text-xs font-medium text-primary">
                        {t("dashboard.command.ceoAgent")}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap text-base leading-relaxed">
                      {msg.content}
                    </p>
                    <p
                      className={cn(
                        "mt-2 text-xs",
                        msg.role === "user"
                          ? "text-primary-foreground/60"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatTimestamp(msg.timestamp)}
                    </p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15">
                    <Loader2 className="size-4 animate-spin text-primary" />
                  </div>
                  <span className="text-sm">
                    {t("dashboard.command.thinking")}
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {error && (
            <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("dashboard.command.placeholder")}
              rows={hasMessages ? 2 : 4}
              disabled={isLoading}
              className={cn(
                "w-full resize-none rounded-2xl border border-border bg-background/40",
                "px-6 py-5 text-lg text-foreground placeholder:text-muted-foreground/60",
                "focus:outline-none focus:ring-2 focus:ring-primary/25",
                "disabled:opacity-60",
              )}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={cn(
                "absolute bottom-4 right-4 flex size-12 items-center justify-center rounded-xl",
                "bg-primary text-primary-foreground transition-opacity",
                "disabled:opacity-40",
              )}
              aria-label={t("common.sendMessage")}
            >
              {isLoading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <ArrowUp className="size-5" />
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-base text-muted-foreground">
            {isLoading
              ? t("dashboard.command.readingBrain", {
                  brainName: platform.brainName,
                })
              : t("dashboard.command.poweredBy", {
                  brainName: platform.brainName,
                })}
          </p>
        </div>

        {!hasMessages && (
          <div className="mt-12 space-y-6">
            <p className="text-center text-label">
              {t("dashboard.command.tryAsking")}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {suggestedQuestions.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => sendMessage(label)}
                  disabled={isLoading}
                  className={cn(
                    "rounded-full border border-border bg-card/40 px-6 py-3",
                    "text-base text-muted-foreground transition-all duration-300",
                    "hover:border-primary/30 hover:bg-primary/5 hover:text-foreground",
                    "disabled:opacity-50",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
