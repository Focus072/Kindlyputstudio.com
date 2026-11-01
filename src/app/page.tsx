import Link from "next/link";
import { brand } from "@/config/brand";

// Placeholder home page. The full Kindly Put landing page arrives in Phase 4.
export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 text-center">
      <p className="font-typewriter text-sm text-slate-500">{brand.city}</p>
      <h1 className="mt-3 font-display text-6xl uppercase tracking-wide text-slate-900 sm:text-8xl">{brand.name}</h1>
      <p className="mt-4 max-w-md text-lg text-slate-600">
        Photo and video for local businesses, delivered in a room built for you.
      </p>
      <Link href="/admin" className="mt-8 rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white">
        Studio sign in
      </Link>
    </main>
  );
}
