import Link from "next/link";
import { brand } from "@/config/brand";

// Placeholder home page. The full Kindly Put Studio landing page arrives in Phase 4.
export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-ink px-6 text-center text-cloud">
      <img src={brand.logo.fullOnDark} alt={brand.name} className="h-32 w-auto sm:h-40" />
      <h1 className="mt-10 font-display text-6xl uppercase leading-[0.9] sm:text-8xl">
        Kindly put.
        <br />
        <span className="text-steel">Boldly seen.</span>
      </h1>
      <p className="mt-6 max-w-md text-lg text-mist/80">
        Photo and video for {brand.city.split(",")[0]} businesses, delivered in a room built just for you.
      </p>
      <Link href="/admin" className="mt-10 rounded-full bg-steel px-6 py-3 text-sm font-bold uppercase tracking-wider text-ink">
        Studio sign in
      </Link>
      <nav className="absolute inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] flex justify-center gap-6 text-xs text-mist/60">
        <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
        <Link href="/terms" className="hover:text-white">Terms of Service</Link>
      </nav>
    </main>
  );
}
