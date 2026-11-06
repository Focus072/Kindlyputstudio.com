"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { when } from "@/lib/ai-team/format";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  author: string | null;
  at: string;
  pending?: boolean;
  /** Shown instead of the time, e.g. "not saved". */
  note?: string;
  /** Claude declined this message, so it isn't sent with later turns. */
  declined?: boolean;
}

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
  // props.initial is the history from the database. `local` holds this tab's
  // bubbles that aren't in it (yet): the message being sent and the reply
  // streaming in, or an error note that should stay on screen.
  const [local, setLocal] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [awaitingSaved, setAwaitingSaved] = useState(false);
  const [seenInitial, setSeenInitial] = useState(props.initial);
  const body = useRef<HTMLDivElement>(null);

  // A fresh copy from the server (after router.refresh()) replaces the local
  // bubbles. If the reply didn't make it into the database, its note stays.
  // The composer stays locked until then, so a quick follow-up can't be
  // wiped by the previous turn's refresh.
  if (props.initial !== seenInitial) {
    setSeenInitial(props.initial);
    if (awaitingSaved) {
      setAwaitingSaved(false);
      setBusy(false);
      const last = props.initial[props.initial.length - 1];
      setLocal(last?.role === "user" ? local.filter((m) => m.role === "assistant").map((m) => ({ ...m, note: "not saved" })) : []);
    }
  }

  // Safety net: if the refreshed history never arrives, free the composer.
  useEffect(() => {
    if (!awaitingSaved) return;
    const t = setTimeout(() => {
      setAwaitingSaved(false);
      setBusy(false);
    }, 15000);
    return () => clearTimeout(t);
  }, [awaitingSaved]);

  const messages = [...props.initial, ...local];
  useEffect(() => {
    const el = body.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, local]);

  async function send(text: string) {
    text = text.trim();
    if (!text || busy) return;
    setBusy(true);
    setDraft("");
    const now = new Date().toISOString();
    const replyId = `a-${now}`;
    const setReply = (fn: (content: string) => string) =>
      setLocal((l) => l.map((x) => (x.id === replyId ? { ...x, content: fn(x.content) } : x)));
    setLocal([
      { id: `u-${now}`, role: "user", content: text, author: "You", at: now, pending: true },
      { id: replyId, role: "assistant", content: "", author: null, at: now, pending: true },
    ]);
    let reachedServer = false;
    try {
      const res = await fetch("/api/admin/ai-team/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: props.clientId, conversationId: props.conversationId, text }),
      });
      if (!res.ok || !res.body) {
        // Nothing was saved. Keep both bubbles so the reason stays visible.
        const err = (await res.text().catch(() => "")).trim();
        setLocal((l) =>
          l.map((x) =>
            x.id === replyId
              ? { ...x, pending: false, note: "not saved", content: `[${err || "Couldn't reach the server."}]` }
              : { ...x, pending: false, note: "not sent" },
          ),
        );
        setDraft(text); // so it can be sent again
        return;
      }
      reachedServer = true;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        setReply((c) => c + chunk);
      }
    } catch {
      setReply((c) => c + "\n\n[Connection lost. This reply may not have been saved.]");
    } finally {
      setLocal((l) => l.map((x) => ({ ...x, pending: false })));
      if (reachedServer) {
        // Reload the saved history; the check above swaps it in and frees the composer.
        setAwaitingSaved(true);
        router.refresh();
      } else {
        setBusy(false);
      }
    }
  }

  return (
    <>
      <div className="chat-body" ref={body}>
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
                  {m.pending ? (m.role === "assistant" && busy ? "replying…" : "sending…") : m.note ?? when(m.at)}
                  {m.declined && " · declined, left out of the chat"}
                </div>
                <div className="bubble">{m.content || (m.pending ? "…" : "")}</div>
                {!m.pending && m.role === "assistant" && props.handoffForms[m.id] && (
                  <div className="tools">{props.handoffForms[m.id]}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="chat-foot">
        <form onSubmit={(e) => { e.preventDefault(); send(draft); }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(draft); }
            }}
            placeholder={`Message ${s.name}…`}
            aria-label={`Message ${s.name}`}
            rows={2}
            disabled={busy}
          />
          <button type="submit" disabled={busy || !draft.trim()}>{busy ? "Waiting…" : "Send"}</button>
        </form>
      </div>
    </>
  );
}
