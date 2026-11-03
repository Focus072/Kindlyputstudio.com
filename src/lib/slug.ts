import { randomBytes } from "node:crypto";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomCode(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Readable but unguessable room link, for example "adro-m4-k7x2pqh9wm" (31^10 codes). */
export function roomSlug(title: string): string {
  const base = slugify(title) || "room";
  return `${base}-${randomCode(10)}`;
}

export function randomFileKey(): string {
  return randomCode(16);
}
