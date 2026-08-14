import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Send, Loader2, Bot, ChevronDown, CircleDot } from "lucide-react";
import { cn } from "@/lib/cn";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type Role = "user" | "assistant" | "system";

interface Message {
  id: string;
  role: Role;
  content: string;
  ts: Date;
  pending?: boolean;
}

/* ─── Simulated AI responses ─────────────────────────────────────────────── */

const OPENING: Message = {
  id: "sys-0",
  role: "assistant",
  content:
    "Hello. I'm your Accenty intelligence assistant.\n\nI'm here to help you capture information about your firm — your operations, case workflows, client relationships, investigator structure, and anything else relevant. The more context you share, the better I can tailor the system to your needs.\n\nLet's start simple: **how would you describe your firm and the primary type of work you handle?**",
  ts: new Date(),
};

const FOLLOW_UPS: string[] = [
  "That's helpful context. Could you tell me more about how cases are typically assigned to investigators? Is it geographic, by specialisation, or something else?",
  "Understood. And when it comes to clients — are they mostly corporate entities, legal firms, or private individuals? How do billing conversations usually go?",
  "I see. How do investigators currently report their activity in the field — time logs, location check-ins, written reports? What matters most to you there?",
  "That gives me a clear picture. One last area: what does a typical month look like in terms of volume? Roughly how many active cases, and how many investigators on the roster?",
  "Thank you — that's everything I need for now. I'll forward this briefing to the Accenty backend for processing. You'll be able to review the extracted profile before anything is finalised.\n\n*This conversation has been queued for backend review.*",
];

let followUpIndex = 0;

function simulateReply(
  _input: string,
  onChunk: (chunk: string) => void,
  onDone: () => void,
): () => void {
  const text =
    FOLLOW_UPS[Math.min(followUpIndex, FOLLOW_UPS.length - 1)] ??
    "Thank you for sharing that. Is there anything else you'd like to add?";
  followUpIndex++;

  let i = 0;
  const delay = 480;
  const chunkSize = 3;

  const timer = window.setTimeout(function tick() {
    if (i >= text.length) {
      onDone();
      return;
    }
    onChunk(text.slice(i, i + chunkSize));
    i += chunkSize;
    window.setTimeout(tick, 18);
  }, delay);

  return () => window.clearTimeout(timer);
}

/* ─── Utilities ──────────────────────────────────────────────────────────── */

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ─── Markdown-lite renderer ─────────────────────────────────────────────── */

function renderContent(text: string) {
  const parts: React.ReactNode[] = [];
  const paras = text.split(/\n\n+/);

  paras.forEach((para, pi) => {
    // bold **text**
    const segments: React.ReactNode[] = [];
    const boldRe = /\*\*(.+?)\*\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = boldRe.exec(para)) !== null) {
      if (m.index > last) segments.push(para.slice(last, m.index));
      segments.push(
        <strong key={m.index} className="font-semibold text-[var(--color-text-hi)]">
          {m[1]}
        </strong>,
      );
      last = m.index + m[0].length;
    }
    if (last < para.length) segments.push(para.slice(last));

    // italic *text*
    const rendered: React.ReactNode[] = [];
    segments.forEach((seg, si) => {
      if (typeof seg !== "string") {
        rendered.push(seg);
        return;
      }
      const italicRe = /\*(.+?)\*/g;
      let l2 = 0;
      let m2: RegExpExecArray | null;
      while ((m2 = italicRe.exec(seg)) !== null) {
        if (m2.index > l2) rendered.push(seg.slice(l2, m2.index));
        rendered.push(
          <em key={`${si}-${m2.index}`} className="italic text-[var(--color-text-mid)]">
            {m2[1]}
          </em>,
        );
        l2 = m2.index + m2[0].length;
      }
      if (l2 < seg.length) rendered.push(seg.slice(l2));
    });

    parts.push(
      <p key={pi} className={cn(pi > 0 && "mt-3")}>
        {rendered}
      </p>,
    );
  });

  return <>{parts}</>;
}

/* ─── Message bubble ─────────────────────────────────────────────────────── */

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

  return (
    <div
      className={cn(
        "group flex w-full gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="mt-0.5 flex-shrink-0">
          <div
            className="grid h-7 w-7 place-items-center rounded-full"
            style={{
              background:
                "linear-gradient(135deg, var(--color-accent), #1f3a8a)",
              boxShadow:
                "0 0 0.75rem color-mix(in srgb, var(--color-accent) 35%, transparent)",
            }}
          >
            <Bot size={13} strokeWidth={1.8} className="text-white" />
          </div>
        </div>
      )}

      {/* Bubble */}
      <div
        className={cn(
          "relative max-w-[72%] rounded-2xl px-4 py-3 text-[0.84375rem] leading-relaxed",
          isUser
            ? [
                "rounded-tr-sm",
                "bg-[var(--color-accent-soft)]",
                "text-[var(--color-text-hi)]",
                "border border-[var(--color-accent-soft)]",
                "shadow-[0_0_0_0.0625rem_color-mix(in_srgb,var(--color-accent)_18%,transparent)]",
              ]
            : [
                "rounded-tl-sm",
                "bg-[var(--color-ink-2)]",
                "text-[var(--color-text-mid)]",
                "border border-[var(--color-line-2)]",
                "shadow-[inset_0_0.0625rem_0_var(--color-surface-shine)]",
              ],
        )}
      >
        {msg.pending ? (
          <TypingDots />
        ) : (
          renderContent(msg.content)
        )}

        <div
          className={cn(
            "mt-2 font-mono text-[0.59375rem] opacity-0 transition-opacity group-hover:opacity-60",
            isUser ? "text-right text-[var(--color-accent-2)]" : "text-[var(--color-text-lo)]",
          )}
        >
          {formatTime(msg.ts)}
        </div>
      </div>
    </div>
  );
}

/* ─── Typing indicator ───────────────────────────────────────────────────── */

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-lo)]"
          style={{
            animation: "assistant-dot-pulse 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Scroll-to-bottom button ────────────────────────────────────────────── */

function ScrollBtn({ onClick, visible }: { onClick: () => void; visible: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Scroll to bottom"
      className={cn(
        "absolute bottom-4 right-4 z-10 grid h-8 w-8 place-items-center rounded-full",
        "border border-[var(--color-line-2)] bg-[var(--color-ink-2)]",
        "text-[var(--color-text-mid)] shadow-md",
        "transition-all duration-200",
        visible ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-2",
      )}
    >
      <ChevronDown size={14} strokeWidth={2} />
    </button>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>([OPENING]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const atBottomRef = useRef(true);

  /* Auto-resize textarea */
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  /* Scroll tracking */
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottomRef.current = nearBottom;
    setShowScrollBtn(!nearBottom);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: smooth ? "smooth" : "instant",
    });
  }, []);

  /* Scroll when new messages arrive if we're at the bottom */
  useEffect(() => {
    if (atBottomRef.current) scrollToBottom();
  }, [messages, scrollToBottom]);

  /* Send */
  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg: Message = {
      id: uid(),
      role: "user",
      content: text,
      ts: new Date(),
    };

    const pendingMsg: Message = {
      id: uid(),
      role: "assistant",
      content: "",
      ts: new Date(),
      pending: true,
    };

    setMessages((prev) => [...prev, userMsg, pendingMsg]);
    setInput("");
    setIsTyping(true);
    atBottomRef.current = true;

    const pendingId = pendingMsg.id;
    let accumulated = "";

    cancelRef.current = simulateReply(
      text,
      (chunk) => {
        accumulated += chunk;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, content: accumulated, pending: false }
              : m,
          ),
        );
      },
      () => {
        setIsTyping(false);
        cancelRef.current = null;
      },
    );
  }, [input, isTyping]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const forwardToBackend = () => {
    const payload = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));
    console.log("[Assistant] Forwarding to backend:", payload);
    // TODO: POST /api/assistant/conversation
  };

  const conversationStarted = messages.length > 1;

  return (
    <div className="assistant-page flex h-full flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="assistant-header flex shrink-0 items-center justify-between border-b border-[var(--color-line)] px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className="grid h-8 w-8 place-items-center rounded-full"
            style={{
              background: "linear-gradient(135deg, var(--color-accent), #1f3a8a)",
              boxShadow: "0 0 0.875rem color-mix(in srgb, var(--color-accent) 40%, transparent)",
            }}
          >
            <Bot size={15} strokeWidth={1.8} className="text-white" />
          </div>
          <div>
            <h1
              className="text-[0.8125rem] font-medium tracking-wide text-[var(--color-text-hi)]"
              style={{ fontFamily: "var(--font-eyebrow)", letterSpacing: "0.18em" }}
            >
              INTELLIGENCE ASSISTANT
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <CircleDot
                size={8}
                strokeWidth={2.5}
                className={isTyping ? "text-[var(--color-warn)]" : "text-[var(--color-pos)]"}
                style={
                  isTyping
                    ? {}
                    : { filter: "drop-shadow(0 0 0.25rem var(--color-pos))" }
                }
              />
              <span className="font-mono text-[0.59375rem] text-[var(--color-text-lo)]">
                {isTyping ? "Processing…" : "Online"}
              </span>
            </div>
          </div>
        </div>

        {conversationStarted && (
          <button
            type="button"
            onClick={forwardToBackend}
            className="assistant-forward-btn"
          >
            Forward briefing
          </button>
        )}
      </div>

      {/* ── Messages ───────────────────────────────────────────────────── */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto px-6 py-6"
        >
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            {messages.map((msg) => (
              <Bubble key={msg.id} msg={msg} />
            ))}

            {/* Typing indicator as separate bubble while waiting for first chunk */}
            {isTyping && messages[messages.length - 1]?.pending && null}
          </div>
          <div className="h-4" />
        </div>
        <ScrollBtn onClick={() => scrollToBottom()} visible={showScrollBtn} />
      </div>

      {/* ── Input bar ──────────────────────────────────────────────────── */}
      <div className="assistant-input-bar shrink-0 border-t border-[var(--color-line)] px-6 py-4">
        <div className="mx-auto max-w-2xl">
          <div
            className={cn(
              "assistant-input-shell flex items-end gap-3 rounded-2xl px-4 py-3",
              "border border-[var(--color-line-2)] bg-[var(--color-ink-2)]",
              "shadow-[inset_0_0.0625rem_0_var(--color-surface-shine)]",
              "transition-shadow duration-200",
              "focus-within:border-[var(--color-accent-soft)] focus-within:shadow-[0_0_0_0.125rem_var(--color-accent-soft)]",
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your firm, workflows, or anything relevant…"
              rows={1}
              disabled={isTyping}
              className={cn(
                "min-h-0 flex-1 resize-none bg-transparent",
                "text-[0.84375rem] leading-relaxed text-[var(--color-text-hi)]",
                "placeholder:text-[var(--color-text-lo)]",
                "outline-none",
                "disabled:opacity-50",
              )}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={!input.trim() || isTyping}
              className="assistant-send-btn"
              aria-label="Send message"
            >
              {isTyping ? (
                <Loader2
                  size={16}
                  strokeWidth={2}
                  className="animate-spin opacity-70"
                />
              ) : (
                <Send size={15} strokeWidth={2} />
              )}
            </button>
          </div>
          <p className="mt-2 text-center font-mono text-[0.59375rem] text-[var(--color-text-lo)]">
            Press <kbd className="rounded border border-[var(--color-line-2)] px-1 py-0.5 text-[0.5rem]">Enter</kbd> to send
            · <kbd className="rounded border border-[var(--color-line-2)] px-1 py-0.5 text-[0.5rem]">Shift + Enter</kbd> for newline
          </p>
        </div>
      </div>
    </div>
  );
}
