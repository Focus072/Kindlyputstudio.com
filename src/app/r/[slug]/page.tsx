import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoomView } from "@/components/room/RoomView";
import { clientMayOpen, myAccessRequest } from "@/lib/access";
import { isAdmin } from "@/lib/auth";
import { getClientUser, recordClientVisit } from "@/lib/client-auth";
import { currentFiles, getFiles, getRoomBySlug, isRoomExpired, isRoomOpen, loadRoomBundle } from "@/lib/data";
import { supabasePublicConfig } from "@/lib/env";
import { getStudioSettings } from "@/lib/settings";
import { previewUrl } from "@/lib/storage";
import { RequestAccess } from "./RequestAccess";
import { RoomClosed } from "./RoomClosed";

export async function generateMetadata({ params }: PageProps<"/r/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const room = await getRoomBySlug(slug);
  if (!room) return { title: "Room not found", robots: { index: false } };
  const title = `${room.title} · Prepared for ${room.client_name}`;
  const description = `Your files from ${room.delivered_by}. Tap to review, approve, and download.`;
  // Link previews in Messages, WhatsApp, and email show the room's cover photo.
  // This is the same teaser image the sign-up screen already shows to anyone with the link.
  let cover: string | null = null;
  // Guest-list rooms keep their cover private too.
  if (isRoomOpen(room) && room.access_mode !== "invited") {
    const files = currentFiles(await getFiles(room.id));
    const hero = files.find((f) => f.id === room.hero_file_id) ?? files[0];
    cover = previewUrl(hero?.thumb_path ?? hero?.poster_path ?? null);
  }
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", ...(cover ? { images: [{ url: cover, alt: room.title }] } : {}) },
    twitter: { card: "summary_large_image", title, description, ...(cover ? { images: [cover] } : {}) },
  };
}

export default async function RoomPage({ params, searchParams }: PageProps<"/r/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const room = await getRoomBySlug(slug);
  if (!room) notFound();

  const [admin, client, studio] = await Promise.all([isAdmin(), getClientUser(), getStudioSettings()]);
  if (!isRoomOpen(room) && !admin) return <RoomClosed room={room} expired={isRoomExpired(room)} studio={studio} />;

  const roomProps = {
    slug: room.slug,
    title: room.title,
    clientName: room.client_name,
    deliveredBy: room.delivered_by,
    themePreset: room.theme_preset,
    accentColor: room.accent_color,
    layout: room.layout ?? "grid",
    watermark: !!room.watermark,
    intro: room.intro ?? null,
    downloads: room.downloads ?? "on",
    paymentUrl: room.payment_url ?? null,
    paymentStatus: room.payment_status ?? "none",
    feedbackSentAt: room.feedback_sent_at ?? null,
  };
  const brandProps = { name: studio.name, mark: studio.markOnDark, poweredByLabel: studio.poweredByLabel };

  // Not signed in: show the room shell behind the create-account popup.
  // No files or download links are sent until the client has an account.
  if (!client && !admin) {
    const files = currentFiles(await getFiles(room.id));
    const hero = files.find((f) => f.id === room.hero_file_id) ?? files[0];
    const showTeaser = room.access_mode !== "invited";
    const { url, key } = supabasePublicConfig();
    return (
      <RoomView
        room={roomProps}
        files={[]}
        heroId={null}
        initialViews={0}
        brand={brandProps}
        viewer={null}
        gate={{
          supabaseUrl: url,
          supabaseKey: key,
          fileCount: files.length,
          teaserUrl: showTeaser ? previewUrl(hero?.thumb_path ?? hero?.poster_path ?? null) : null,
          authError: sp.auth_error === "confirmed" ? "confirmed" : sp.auth_error === "1" ? "1" : null,
        }}
      />
    );
  }

  // Guest-list rooms: signed in, but not invited, so ask the studio.
  if (client && !admin && !(await clientMayOpen(room, client))) {
    await recordClientVisit(client);
    const status = await myAccessRequest(room.id, client.id);
    return <RequestAccess room={room} studio={studio} email={client.email} initialStatus={status} />;
  }

  if (client) await recordClientVisit(client, room.id);
  const { files, stats, hero } = await loadRoomBundle(room);

  return (
    <RoomView
      room={roomProps}
      files={files}
      heroId={hero?.id ?? null}
      initialViews={stats.views}
      brand={brandProps}
      viewer={client ? { name: client.name, avatarUrl: client.avatarUrl } : null}
      preview={admin && !client}
      adminRoomId={admin ? room.id : null}
    />
  );
}
