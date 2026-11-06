# Kindly Put Rooms

Branded delivery rooms for Kindly Put Agency. Every client gets one clean link
with their project title, a hero photo, and a grid of every photo and video
they can approve, decline, or comment on.

- **Client room:** `/r/<link>`. No login. The link is unguessable.
- **Admin:** `/admin`. Create rooms, drag and drop uploads, pick the hero, see approvals and comments.

Built with Next.js, Tailwind CSS, Framer Motion, and Supabase. Deploys on Vercel.

## Run it on your computer

You need [Node.js 20 or newer](https://nodejs.org).

1. Install packages:
   ```bash
   npm install
   ```
2. Copy the settings file and fill it in:
   ```bash
   cp .env.example .env.local
   ```
   Open `.env.local` and paste your Supabase URL and secret key (the file
   says where to find each one).
3. Set up the database once. In Supabase, open **SQL Editor > New query**,
   paste each file in `supabase/migrations/` in order (0001, 0002, ...), and
   press **Run** after each one.
4. Create your admin login (see **Admin accounts** below).
5. Start the app:
   ```bash
   npm run dev
   ```
6. Open http://localhost:3000/login, sign in with your username and password,
   create a room, drop in some photos, and press **Open room**.

## Put it online (Vercel)

1. In Vercel, **Add New > Project** and import this GitHub repo.
2. Under **Environment Variables**, add the same values from `.env.local`.
   If you connect Supabase through Vercel's Supabase integration instead, the
   Supabase values are added for you and nothing else is needed.
3. Press **Deploy**. Every merge to `main` redeploys automatically.

## Admin accounts

Studio logins live in the `admin_users` table. Passwords are stored as
scrypt hashes, never in plain text. To add someone or reset a password:

1. Make a hash: `node scripts/hash-password.mjs "their-password"`
2. In Supabase **SQL Editor**, run:
   ```sql
   insert into admin_users (username, display_name, password_hash)
   values ('Name', 'Name', 'PASTE-HASH-HERE')
   on conflict (lower(username)) do update set password_hash = excluded.password_hash;
   ```

Usernames are not case sensitive.

## Studio settings

Name, logo, contact email, the "Powered by" tag, and the default theme are
edited in **Admin > Settings**. Anything left blank falls back to
`src/config/brand.ts`.

## Change the branding

- **Logo, name, colors:** edit `src/config/brand.ts` and drop the logo in `public/brand/`.
- **Room themes:** edit or add presets in `src/config/themes.ts`. Each room
  picks a preset and its own accent color from the admin.

## Content calendar

Admin > Calendar plans and publishes social posts for every client. Buffer does
the actual publishing; this app is the place you work in.

1. Run `supabase/migrations/0005_content_calendar.sql`.
2. In Buffer, connect each client's accounts, then create an API key
   (Settings > API). Paste it in Calendar > Settings.
3. Press "Make a client for each channel" (or add clients by hand) and pick a
   color for each one.
4. New post: choose accounts, add photos or a video, write the caption, then
   pick a time, the next queue slot, post now, or save a draft. Edit, delete,
   duplicate, or drag a post to another day right on the calendar.

Photos and videos for posts are stored in the public `previews` bucket under
`social/`, so the networks can fetch them. Times use
`NEXT_PUBLIC_STUDIO_TIMEZONE` (default America/Los_Angeles). Plans (ideas that
are not in Buffer) stay on the calendar only.

## How it fits together

| Folder | What lives there |
| --- | --- |
| `src/app/r/[slug]` | The client delivery room, its approve/decline/comment actions, and downloads |
| `src/app/admin` | Admin pages and actions |
| `src/components/room` | Room UI: backdrop glow, tiles, review buttons, comments, viewer |
| `src/components/admin` | Uploader, room form, file grid |
| `src/lib` | Database queries, admin login, in-browser image resizing |
| `supabase/migrations` | Database tables, security rules, storage buckets |

Photos are resized in your browser before upload: a small thumbnail for the
grid and a web preview for the hero and viewer, both served from the Supabase
CDN. The untouched original is stored privately and only handed out through
short-lived download links. Videos play inline from a signed link with a poster frame.

**Upload size:** Supabase limits each file to 50 MB by default. For larger
videos, raise it in Supabase under **Storage > Settings > Upload file size limit**
(Pro plan allows up to 500 GB).
