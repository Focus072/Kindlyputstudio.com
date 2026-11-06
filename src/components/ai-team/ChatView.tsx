"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Msg { id: string; role: "user" | "assistant"; content: string; author: string | null; at: string; pending?: boolean }

export function ChatView(props: {
  clientId: string;
  conversationId: string;
  specialist: { id: string; name: string; color: string; starters: string[] };
  claudeReady: boolean;
  initial: Msg[];
  handoffForms: Record<string, React.ReactNode>;
}) {
  const { specialist: s } = props;
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(props.initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  // When the server sends a fresh copy (after a reply is saved), use it.
  useEffect(() => { if (!busy) setMessages(props.initial); }, [props.initial, busy]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(text: string) {
    text = text.trim();
    if (!text || busy) return;
    setBusy(true);
    setDraft("");
    const now = new Date().toISOString();
    setMessages((m) => [
      ...m,
      { id: `u-${now}`, role: "user", content: text, author: "You", at: now, pending: true },
      { id: `a-${now}`, role: "assistant", content: "", author: null, at: now, pending: true },
    ]);
    try {
      const res = await fetch("/api/admin/ai-team/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: props.clientId, conversationId: props.conversationId, text }),
      });
      if (!res.ok || !res.body) {
        const err = await res.text();
        setMessages((m) => m.map((x) => (x.id === `a-${now}` ? { ...x, content: `[${err || "Couldn't reach the server."}]` } : x)));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        setMessages((m) => m.map((x) => (x.id === `a-${now}` ? { ...x, content: x.content + chunk } : x)));
      }
    } catch {
      setMessages((m) => m.map((x) => (x.id === `a-${now}` ? { ...x, content: x.content + "\n\n[Connection lost. This reply may not have been saved.]" } : x)));
    } finally {
      setBusy(false);
      router.refresh(); // reload saved history from the database
    }
  }

  return (
    <>
      <div className="chat-body">
        <div className="chat-inner">
          {messages.length === 0 && (
            <div className="card">
              <p>
                You&apos;re chatting with <strong>{s.name}</strong>, an AI team member. This conversation is saved for your whole team.
              </p>
              {!props.claudeReady && (
                <p className="notice">Claude isn&apos;t connected yet (ANTHROPIC_API_KEY is missing), so {s.name} can&apos;t reply.</p>
              )}
              <p className="small muted">Try one of these:</p>
              <div className="row">
                {s.starters.map((t) => (
                  <button key={t} type="button" className="secondary small" onClick={() => setDraft(t)}>{t}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`msg ${m.role}`}>
              {m.role === "assistant" ? (
                <span className="avatar" style={{ width: 32, height: 32, background: s.color, fontSize: 14 }} title={`${s.name} · AI`}>
                  {s.name[0]}
                </span>
              ) : (
                <span className="avatar" style={{ width: 32, height: 32, background: "#9aa6ab", fontSize: 14 }}>
                  {(m.author ?? "?")[0]}
                </span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="meta">
                  {m.role === "assistant" ? `${s.name} (AI)` : m.author ?? "Team member"} ·{" "}
                  {m.pending ? (m.role === "assistant" && busy ? "replying…" : "sending…") : new Date(m.at).toLocaleString()}
                </div>
                <div className="bubble">{m.content || (busy ? "…" : "")}</div>
                {!m.pending && m.role === "assistant" && props.handoffForms[m.id] && (
                  <div className="tools">{props.handoffForms[m.id]}</div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottom} />
        </div>
      </div>
      <div className="chat-foot">
        <form onSubmit={(e) => { e.preventDefault(); send(draft); }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); }
            }}
            placeholder={`Message ${s.name}… (Enter to send, Shift+Enter for a new line)`}
            rows={2}
            disabled={busy}
          />
          <button type="submit" disabled={busy || !draft.trim()}>{busy ? "Waiting…" : "Send"}</button>
        </form>
      </div>
    </>
  );
}
