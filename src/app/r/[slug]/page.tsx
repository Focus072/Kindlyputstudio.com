import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoomView } from "@/components/room/RoomView";
import { brand } from "@/config/brand";
import { isAdmin } from "@/lib/auth";
import { getRoomBySlug, isRoomExpired, isRoomOpen, loadRoomBundle } from "@/lib/data";
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

export default async function RoomPage({ params }: PageProps<"/r/[slug]">) {
  const { slug } = await params;
  const room = await getRoomBySlug(slug);
  if (!room) notFound();

  const admin = await isAdmin();
  if (!isRoomOpen(room) && !admin) return <RoomClosed room={room} expired={isRoomExpired(room)} />;

  const { files, stats, hero } = await loadRoomBundle(room);

  return (
    <RoomView
      room={{
        slug: room.slug,
        title: room.title,
        clientName: room.client_name,
        deliveredBy: room.delivered_by,
        themePreset: room.theme_preset,
        accentColor: room.accent_color,
      }}
      files={files}
      heroId={hero?.id ?? null}
      initialViews={stats.views}
      brand={{ name: brand.name, mark: brand.logo.markOnDark, poweredByLabel: brand.poweredByLabel }}
      preview={admin}
    />
  );
}
