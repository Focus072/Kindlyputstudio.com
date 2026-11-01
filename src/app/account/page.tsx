import type { Metadata } from "next";
import Link from "next/link";
import { AuthModal } from "@/components/auth/AuthModal";
import { brand } from "@/config/brand";
import { getTheme } from "@/config/themes";
import { getClientUser, recordClientVisit } from "@/lib/client-auth";
import { supabasePublicConfig } from "@/lib/env";
import { previewUrl } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { RoomRow } from "@/lib/types";

export const metadata: Metadata = { title: "My rooms", robots: { index: false } };

type RoomCard = RoomRow & { coverPath: string | null; fileCount: number; lastOpened: string };

async function roomsFor(clientId: string): Promise<RoomCard[]> {
  const db = supabaseAdmin();
  const { data: links } = await db
    .from("room_clients")
    .select("room_id, last_opened_at")
    .eq("client_id", clientId)
    .order("last_opened_at", { ascending: false });
  const ids = (links ?? []).map((l) => l.room_id);
  if (ids.length === 0) return [];
  const [{ data: rooms }, { data: files }] = await Promise.all([
    db.from("rooms").select("*").in("id", ids).eq("status", "live"),
    db.from("files").select("id, room_id, thumb_path, poster_path, sort_order").in("room_id", ids).order("sort_order"),
  ]);
  return (links ?? [])
    .map((l) => {
      const room = (rooms ?? []).find((r) => r.id === l.room_id) as RoomRow | undefined;
      if (!room) return null;
      const roomFiles = (files ?? []).filter((f) => f.room_id === room.id);
      const cover = roomFiles.find((f) => f.id === room.hero_file_id) ?? roomFiles[0];
      return {
        ...room,
        coverPath: cover?.thumb_path ?? cover?.poster_path ?? null,
        fileCount: roomFiles.length,
        lastOpened: l.last_opened_at as string,
      };
    })
    .filter((r): r is RoomCard => r !== null);
}

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const sp = await searchParams;
  const client = await getClientUser();

  if (!client) {
    const { url, key } = supabasePublicConfig();
    return (
      <main className="min-h-dvh bg-ink">
        <AuthModal
          supabaseUrl={url}
          supabaseKey={key}
          next="/account"
          brandMark={brand.logo.markOnDark}
          heading="Your rooms"
          subheading={`Create an account or sign in to see every room ${brand.name} has delivered to you.`}
          initialError={sp.auth_error === "confirmed" ? "confirmed" : sp.auth_error === "1" ? "1" : null}
        />
      </main>
    );
  }

  await recordClientVisit(client);
  const rooms = await roomsFor(client.id);

  return (
    <main className="min-h-dvh bg-ink text-cloud">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 pb-5 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-8">
        <img src={brand.logo.markOnDark} alt={brand.name} className="h-9 w-auto" />
        <form action="/auth/signout" method="post">
          <button className="text-sm text-mist/70 hover:text-white">Sign out</button>
        </form>
      </header>
      <section className="mx-auto max-w-6xl px-5 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 sm:px-8 sm:pt-8">
        <p className="font-typewriter text-sm text-mist/70">Signed in as {client.email ?? client.name}</p>
        <h1 className="mt-2 break-words font-display text-5xl uppercase leading-none sm:text-7xl">
          {client.name.split(" ")[0]}&rsquo;s rooms
        </h1>

        {rooms.length === 0 ? (
          <p className="mt-10 max-w-md text-mist/80">
            No rooms yet. When {brand.name} sends you a delivery link, open it while signed in and it will appear here
            for good.
          </p>
        ) : (
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => {
              const theme = getTheme(room.theme_preset);
              const cover = previewUrl(room.coverPath);
              return (
                <li key={room.id}>
                  <Link
                    href={`/r/${room.slug}`}
                    className="group block overflow-hidden rounded-3xl border border-white/10 bg-white/5 transition-transform hover:-translate-y-1"
                  >
                    <div className="relative aspect-[4/3]" style={{ background: theme.background }}>
                      {cover && (
                        <img
                          src={cover}
                          alt=""
                          className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4">
                        <p className="font-typewriter text-[11px] text-white/70">Prepared for {room.client_name}</p>
                        <p className="mt-1 line-clamp-2 font-display text-3xl uppercase leading-[0.95] text-white">{room.title}</p>
                      </div>
                    </div>
                    <p className="px-4 py-3 text-xs text-mist/70">
                      {room.fileCount} {room.fileCount === 1 ? "file" : "files"} · from {room.delivered_by}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
