import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoomView } from "@/components/room/RoomView";
import { brand } from "@/config/brand";
import { isAdmin } from "@/lib/auth";
import { getClientUser, recordClientVisit } from "@/lib/client-auth";
import { getFiles, getRoomBySlug, isRoomExpired, isRoomOpen, loadRoomBundle } from "@/lib/data";
import { supabasePublicConfig } from "@/lib/env";
import { previewUrl } from "@/lib/storage";
import { RoomClosed } from "./RoomClosed";

export async function generateMetadata({ params }: PageProps<"/r/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const room = await getRoomBySlug(slug);
  if (!room) return { title: "Room not found", robots: { index: false } };
  return {
    title: `${room.title} · Prepared for ${room.client_name}`,
    description: `Your files from ${room.delivered_by}.`,
    robots: { index: false, follow: false },
  };
}

export default async function RoomPage({ params, searchParams }: PageProps<"/r/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const room = await getRoomBySlug(slug);
  if (!room) notFound();

  const [admin, client] = await Promise.all([isAdmin(), getClientUser()]);
  if (!isRoomOpen(room) && !admin) return <RoomClosed room={room} expired={isRoomExpired(room)} />;

  const roomProps = {
    slug: room.slug,
    title: room.title,
    clientName: room.client_name,
    deliveredBy: room.delivered_by,
    themePreset: room.theme_preset,
    accentColor: room.accent_color,
  };
  const brandProps = { name: brand.name, mark: brand.logo.markOnDark, poweredByLabel: brand.poweredByLabel };

  // Not signed in: show the room shell behind the create-account popup.
  // No files or download links are sent until the client has an account.
  if (!client && !admin) {
    const files = await getFiles(room.id);
    const hero = files.find((f) => f.id === room.hero_file_id) ?? files[0];
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
          teaserUrl: previewUrl(hero?.thumb_path ?? hero?.poster_path ?? null),
          authError: sp.auth_error === "1",
        }}
      />
    );
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
