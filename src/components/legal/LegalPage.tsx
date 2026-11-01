import Link from "next/link";
import { brand } from "@/config/brand";

export const LEGAL_UPDATED = "November 1, 2026";

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-ink text-cloud">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 pb-4 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-8">
        <Link href="/" aria-label={`${brand.name} home`}>
          <img src={brand.logo.markOnDark} alt={brand.name} className="h-9 w-auto" />
        </Link>
        <nav className="flex gap-4 text-sm text-mist/70">
          <Link href="/privacy" className="hover:text-white">Privacy</Link>
          <Link href="/terms" className="hover:text-white">Terms</Link>
        </nav>
      </header>
      <article className="mx-auto max-w-3xl px-5 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-8 sm:px-8">
        <p className="font-typewriter text-sm text-mist/60">Last updated {LEGAL_UPDATED}</p>
        <h1 className="mt-2 font-display text-5xl uppercase leading-none sm:text-7xl">{title}</h1>
        <p className="mt-5 text-lg text-mist/85">{intro}</p>
        <div className="legal mt-10 space-y-8 text-[15px] leading-relaxed text-mist/85 [&_a]:text-steel [&_a]:underline [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_p+p]:mt-3 [&_strong]:text-white [&_ul]:mt-3 [&_ul]:space-y-1.5">
          {children}
        </div>
        <footer className="mt-16 border-t border-white/10 pt-6 font-typewriter text-xs text-mist/50">
          {brand.legalName} · {brand.city}
        </footer>
      </article>
    </main>
  );
}
