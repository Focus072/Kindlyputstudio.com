import Anthropic from "@anthropic-ai/sdk";
import { getTeamMember } from "@/lib/ai-team/adapter";
import {
  addMessage, approvedHandoffsFor, getCampaign, getClient, getConversation,
  listGuidelines, listMessages, markDeclined, setConversationTitleIfDefault,
} from "@/lib/ai-team/store";
import { buildWorkspaceContext, claudeConfigured, MODEL, streamReply, toApiMessages } from "@/lib/ai-team/claude";

export const runtime = "nodejs";
export const maxDuration = 300;

function titleFrom(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 60 ? `${t.slice(0, 57)}…` : t || "New conversation";
}

/**
 * Body: { clientId, conversationId, text }
 * Saves the team member's message, streams the specialist's reply as plain
 * text, and saves the reply only once Claude has actually finished it.
 */
export async function POST(req: Request) {
  // Studio login check: signed-out requests never reach Claude or the AI Team tables.
  // Answers 401 rather than redirecting, so the chat can say so instead of
  // showing the login page's HTML as a reply.
  const member = await getTeamMember();
  if (!member) return new Response("You're signed out. Sign in again, then resend your message.", { status: 401 });

  const body = (await req.json().catch(() => null)) as { clientId?: string; conversationId?: string; text?: string } | null;
  const text = body?.text?.trim();
  if (!body?.clientId || !body.conversationId || !text) return new Response("Missing message.", { status: 400 });
  if (text.length > 50_000) return new Response("That message is too long.", { status: 413 });

  const client = await getClient(body.clientId);
  if (!client) return new Response("Client not found.", { status: 404 });
  const convo = await getConversation(client.id, body.conversationId);
  if (!convo) return new Response("Conversation not found.", { status: 404 });

  if (!claudeConfigured()) {
    return new Response(
      "Claude isn't connected yet: ANTHROPIC_API_KEY is missing from the website's environment variables. Your message was not sent.",
      { status: 503 },
    );
  }

  const userMessageId = await addMessage({ conversationId: convo.id, role: "user", content: text, authorId: member.id });
  await setConversationTitleIfDefault(convo.id, titleFrom(text));

  const [history, guidelines, campaign] = await Promise.all([
    listMessages(convo.id),
    listGuidelines(client.id),
    convo.campaign_id ? getCampaign(client.id, convo.campaign_id) : Promise.resolve(null),
  ]);
  const handoffs = await approvedHandoffsFor(client.id, convo.campaign_id);
  const context = buildWorkspaceContext({ client, campaign, guidelines, handoffs, specialistId: convo.specialist_id });

  const encoder = new TextEncoder();
  let clientGone = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // If the browser goes away mid-reply (tab closed, page changed), keep
      // going so the finished reply is still saved for the team.
      const push = (chunk: string) => {
        if (clientGone) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          clientGone = true;
        }
      };
      let text = "";
      try {
        const s = streamReply(convo.specialist_id, context, toApiMessages(history));
        s.on("text", (delta) => {
          text += delta;
          push(delta);
        });
        const final = await s.finalMessage();
        if (final.stop_reason === "refusal") {
          // Every model in the fallback chain declined. Don't save the partial
          // reply, and leave this message out of later turns.
          let note = "Claude declined to answer this. Nothing from this reply was saved, and your message will be left out of the conversation from now on, so try asking another way.";
          try {
            await markDeclined(convo.id, userMessageId);
          } catch (err) {
            console.error("AI Team: couldn't mark a declined message", err);
            note = "Claude declined to answer this. Nothing from this reply was saved. Start a new chat if it keeps happening.";
          }
          push(`\n\n[${note}]`);
        } else {
          let saved = text;
          if (final.stop_reason === "max_tokens") {
            saved += "\n\n[This reply hit the length limit and was cut off.]";
            push("\n\n[This reply hit the length limit and was cut off.]");
          }
          if (saved.trim()) {
            try {
              await addMessage({
                conversationId: convo.id, role: "assistant", content: saved, model: final.model ?? MODEL,
                inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens, stopReason: final.stop_reason,
              });
            } catch (err) {
              console.error("AI Team: couldn't save the reply", err);
              push("\n\n[The reply came through but couldn't be saved. Copy anything you need from it.]");
            }
          }
        }
      } catch (err) {
        let msg = "Something went wrong reaching Claude.";
        if (err instanceof Anthropic.AuthenticationError) msg = "Claude rejected the API key. Check ANTHROPIC_API_KEY in the server settings.";
        else if (err instanceof Anthropic.RateLimitError) msg = "Claude is rate limited right now. Try again in a minute.";
        else if (err instanceof Anthropic.APIError) msg = `Claude returned an error (${err.status ?? "unknown"}).`;
        console.error("AI Team: chat error", err);
        push(`\n\n[${msg} This reply was not saved.]`);
      } finally {
        try {
          controller.close();
        } catch {
          // already closed because the browser left
        }
      }
    },
    cancel() {
      clientGone = true;
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
