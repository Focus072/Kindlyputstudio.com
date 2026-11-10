import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { ReportActions } from "@/components/admin/ReportActions";
import { requireAdmin } from "@/lib/auth";
import { getRoomById, loadRoomBundle } from "@/lib/data";
import { formatTimecode } from "@/lib/format";
import { formatReviewBy } from "@/lib/review-date";
import type { RoomFile } from "@/lib/types";

export const metadata: Metadata = { title: "Feedback report", robots: { index: false } };

function label(f: RoomFile) {
  const bits = [f.version > 1 ? `v${f.version}` : null, f.category].filter(Boolean);
  return bits.length ? `${f.fileName} (${bits.join(", ")})` : f.fileName;
}

function noteLine(c: RoomFile["comments"][number]) {
  return `${c.timecode != null ? `[${formatTimecode(c.timecode)}] ` : ""}${c.author}: ${c.body}`;
}

/** The whole report as plain text, for pasting into a text, email, or editor's notes. */
function asText(title: string, client: string, summary: string, groups: { heading: string; files: RoomFile[]; notes: boolean }[]) {
  const out = [`${title} for ${client}`, summary, ""];
  for (const g of groups) {
    if (g.files.length === 0) continue;
    out.push(`${g.heading.toUpperCase()} (${g.files.length})`);
    g.files.forEach((f, i) => {
      out.push(`${i + 1}. ${label(f)}`);
      if (g.notes) for (const c of f.comments) out.push(`   - ${noteLine(c)}`);
    });
    out.push("");
  }
  return out.join("\n").trim();
}

export default async function FeedbackReportPage({ params }: PageProps<"/admin/rooms/[id]/report">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const room = await getRoomById(id);
  if (!room) notFound();
  const { files, stats } = await loadRoomBundle(room);

  const changes = files.filter((f) => f.status === "changes");
  const notesElsewhere = files.filter((f) => f.status !== "changes" && f.comments.some((c) => !c.fromAgency));
  const approved = files.filter((f) => f.status === "approved");
  const pending = files.filter((f) => f.status === "pending");

  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });
  const reviewBy = formatReviewBy(room.review_by);
  const summary = `As of ${today}: ${stats.approved} approved, ${stats.changes} need changes, ${stats.pending} not reviewed${reviewBy ? ` (review by ${reviewBy})` : ""}.`;
  const groups = [
    { heading: "Changes requested", files: changes, notes: true },
    { heading: "Notes on other files", files: notesElsewhere, notes: true },
    { heading: "Approved", files: approved, notes: false },
    { heading: "Not reviewed yet", files: pending, notes: false },
  ];
  const text = asText(room.title, room.client_name, summary, groups);

  return (
    <main id="feedback-report" className="space-y-8">
      {/* Print only the report, not the admin header and tabs. */}
      <style>{`@media print {
        html, body, .kp-admin { background: #fff !important; }
        body * { visibility: hidden !important; }
        #feedback-report, #feedback-report * { visibility: visible !important; }
        #feedback-report { position: absolute; inset: 0 auto auto 0; width: 100%; padding: 0 24px; }
        .report-no-print { display: none !important; }
        .report-section { break-inside: avoid-page; }
        #feedback-report { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }`}</style>

      <div>
        <Link href={`/admin/rooms/${room.id}`} className="report-no-print inline-flex items-center gap-1 py-1 text-sm text-slate-500 hover:text-ink">
          ← Back to room
        </Link>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="font-typewriter text-sm text-slate-500">Feedback report · {room.client_name}</p>
            <h1 className="mt-1 break-words font-display text-[2.4rem] uppercase leading-[0.95] text-ink sm:text-5xl">{room.title}</h1>
            <p className="mt-3 text-sm text-slate-600">{summary}</p>
          </div>
          <ReportActions text={text} />
        </div>
      </div>

      {files.length === 0 && <p className="text-sm text-slate-500">No files in this room yet.</p>}

      {groups.map((g) =>
        g.files.length === 0 ? null : (
          <section key={g.heading} className="report-section">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-ink">
              {g.heading}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{g.files.length}</span>
            </h2>
            {g.notes ? (
              <ol className="divide-y divide-slate-100 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
                {g.files.map((f, i) => (
                  <li key={f.id} className="flex gap-4 p-4 sm:p-5">
                    <Thumb file={f} />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-ink [overflow-wrap:anywhere]">
                        <span className="mr-1.5 text-slate-400">{i + 1}.</span>
                        {label(f)}
                      </p>
                      {f.reviewedBy && f.status !== "pending" && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {f.status === "changes" ? "Changes asked by" : "Approved by"} {f.reviewedBy}
                        </p>
                      )}
                      {f.comments.length > 0 ? (
                        <ul className="mt-3 space-y-2">
                          {f.comments.map((c) => (
                            <li key={c.id} className={`rounded-2xl px-3.5 py-2.5 text-sm ${c.fromAgency ? "bg-slate-50 text-slate-600" : "bg-mist/40 text-ink"}`}>
                              <span className="font-semibold">{c.author}</span>
                              {c.timecode != null && (
                                <span className="ml-1.5 rounded-full bg-ink px-1.5 py-0.5 font-typewriter text-[11px] text-white">
                                  {formatTimecode(c.timecode)}
                                </span>
                              )}
                              <span className="mt-0.5 block whitespace-pre-wrap">{c.body}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-400">
                          <MessageCircle className="size-3.5" /> No note left
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {g.files.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-slate-200">
                    <Thumb file={f} small />
                    <span className="min-w-0 truncate text-sm text-ink">{label(f)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ),
      )}
    </main>
  );
}

function Thumb({ file, small }: { file: RoomFile; small?: boolean }) {
  const src = file.thumbUrl ?? file.posterUrl;
  const size = small ? "size-11 rounded-xl" : "size-20 rounded-2xl sm:size-24";
  return src ? (
    <img src={src} alt="" loading="lazy" className={`${size} shrink-0 bg-slate-100 object-cover`} />
  ) : (
    <span className={`${size} shrink-0 bg-slate-100`} />
  );
}
