import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Camera, CheckCircle2, Clapperboard, Download, MessageCircle, Sparkles, UserRound } from "lucide-react";
import { brand } from "@/config/brand";
import { LeadForm } from "@/components/landing/LeadForm";
import { RoomMockup } from "@/components/landing/RoomMockup";
import { Showcase } from "@/components/landing/Showcase";
import { listShowcase } from "@/lib/showcase";

export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: `${brand.name} · Photo & video for Bakersfield businesses` },
  description:
    "Kindly Put Studio shoots photo and video for Bakersfield businesses and delivers every file in a private, branded room you can approve and download from.",
  openGraph: { title: `${brand.name} · Kindly put. Boldly seen.`, type: "website" },
};

const services = [
  { icon: Camera, title: "Photography", body: "Products, storefronts, teams, menus, and cars. Edited, color matched, and ready for web, print, and social." },
  { icon: Clapperboard, title: "Video & reels", body: "Short-form vertical video built for Instagram and TikTok, plus longer brand pieces for your site." },
  { icon: Sparkles, title: "Content days", body: "One planned shoot that fills your feed for the month: photos, reels, and behind the scenes in a single visit." },
];

const steps = [
  { n: "01", title: "Plan", body: "A quick call to lock the shot list, location, and timing." },
  { n: "02", title: "Shoot", body: "We show up, direct, and capture. You get back to running your business." },
  { n: "03", title: "Your room", body: "Every edited file lands in a private room with your name on it." },
  { n: "04", title: "Approve", body: "Tap to approve or request changes, leave notes, and download everything." },
];

const roomPerks = [
  { icon: CheckCircle2, text: "Approve or request changes on each photo and video" },
  { icon: MessageCircle, text: "Leave a note on any file and see our replies" },
  { icon: Download, text: "Download one file or the whole shoot in one tap" },
  { icon: UserRound, text: "One account opens every project you’ve done with us" },
];

export default async function Home() {
  const shoots = await listShowcase(6);
  const lead = shoots[0];
  const strip = shoots.flatMap((s) => s.photos.slice(0, 4).map((p) => p.thumb)).slice(0, 14);

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#F4F5F6] text-ink">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-[#F4F5F6]/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label={`${brand.name} home`}>
            <img src={brand.logo.mark} alt="" className="h-9 w-auto" />
            <span className="hidden text-[11px] font-bold uppercase tracking-[0.28em] sm:inline">{brand.name}</span>
          </Link>
          <div className="flex items-center gap-1 text-sm font-semibold sm:gap-2">
            <a href="#work" className="hidden rounded-full px-3 py-2 text-slate-600 hover:text-ink md:inline">Work</a>
            <a href="#services" className="hidden rounded-full px-3 py-2 text-slate-600 hover:text-ink md:inline">Services</a>
            <a href="#rooms" className="hidden rounded-full px-3 py-2 text-slate-600 hover:text-ink md:inline">Delivery rooms</a>
            <Link href="/account" className="rounded-full px-3 py-2 text-slate-600 hover:text-ink">Client login</Link>
            <a href="#start" className="rounded-full bg-ink px-4 py-2.5 text-white">Start a project</a>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(182,195,200,0.55),transparent)]" />
        <div className="relative mx-auto max-w-6xl px-5 pb-10 pt-12 text-center sm:px-8 sm:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 py-1.5 font-typewriter text-xs text-slate-600">
            <span className="size-1.5 rounded-full bg-approve" /> Photo · Video · Content · {brand.city}
          </p>
          <h1 className="mx-auto mt-6 max-w-4xl font-display text-[clamp(3.4rem,13vw,8.5rem)] uppercase leading-[0.88] tracking-[-0.01em]">
            Kindly put.
            <br />
            <span className="relative inline-block px-2">
              <span className="absolute inset-x-0 bottom-[0.08em] top-[0.18em] -z-0 -skew-x-6 rounded-md bg-steel" aria-hidden />
              <span className="relative">Boldly seen.</span>
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 sm:text-xl">
            We shoot photo and video for Bakersfield businesses, then hand it over in a private room with your name on it.
            Approve, comment, and download in one place. No Drive folders. No lost emails.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#start" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-7 py-4 text-sm font-bold text-white sm:w-auto">
              Start a project <ArrowRight className="size-4" />
            </a>
            <a href="#work" className="inline-flex w-full items-center justify-center rounded-full border border-black/10 bg-white px-7 py-4 text-sm font-bold sm:w-auto">
              See recent work
            </a>
          </div>
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pb-16 sm:px-8 sm:pb-24">
          <RoomMockup
            cover={lead?.coverLarge ?? null}
            thumbs={lead ? lead.photos.slice(1, 7).map((p) => p.thumb) : []}
            client={lead?.client ?? "Your business"}
            title={lead?.label ?? "Spring launch shoot"}
            mark={brand.logo.markOnDark}
          />
        </div>
      </section>

      {/* Full-width work strip */}
      {strip.length > 4 && (
        <section aria-hidden className="relative overflow-hidden bg-ink py-4">
          <div className="kp-marquee flex w-max gap-3">
            {[...strip, ...strip].map((src, i) => (
              <img key={i} src={src} alt="" loading="lazy" className="h-44 w-auto rounded-2xl object-cover sm:h-64" />
            ))}
          </div>
        </section>
      )}

      {/* Delivery rooms */}
      <section id="rooms" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <p className="font-typewriter text-sm text-slate-500">Every project, delivered properly</p>
            <h2 className="mt-2 font-display text-5xl uppercase leading-[0.92] sm:text-7xl">
              Your own <span className="text-slate-brand">delivery room</span>
            </h2>
            <p className="mt-5 text-lg text-slate-600">
              When your edits are ready, you get one clean link. It opens a room built for your shoot: your name, your
              photos, and a simple way to sign off.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {roomPerks.map(({ icon: Icon, text }) => (
              <li key={text} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-ink text-white">
                  <Icon className="size-5" />
                </span>
                <p className="mt-4 font-semibold leading-snug">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="scroll-mt-20 bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="font-typewriter text-sm text-slate-500">What we make</p>
          <h2 className="mt-2 font-display text-5xl uppercase leading-none sm:text-7xl">Services</h2>
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {services.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-[28px] bg-[#F4F5F6] p-6 ring-1 ring-black/5 sm:p-8">
                <Icon className="size-7 text-slate-brand" />
                <h3 className="mt-6 font-display text-3xl uppercase">{title}</h3>
                <p className="mt-2 text-slate-600">{body}</p>
              </li>
            ))}
          </ul>

          <ol className="mt-16 grid gap-6 border-t border-black/10 pt-10 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <li key={s.n}>
                <span className="font-typewriter text-sm text-slate-400">{s.n}</span>
                <h3 className="mt-1 font-display text-3xl uppercase">{s.title}</h3>
                <p className="mt-1 text-slate-600">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Work */}
      {shoots.length > 0 && (
        <section id="work" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-typewriter text-sm text-slate-500">Recent work</p>
              <h2 className="mt-2 font-display text-5xl uppercase leading-none sm:text-7xl">Shot in Bakersfield</h2>
            </div>
          </div>
          <div className="mt-10">
            <Showcase shoots={shoots} />
          </div>
        </section>
      )}

      {/* Start a project */}
      <section id="start" className="scroll-mt-16 bg-ink text-cloud">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div>
            <img src={brand.logo.markOnDark} alt="" className="h-12 w-auto" />
            <h2 className="mt-6 font-display text-5xl uppercase leading-[0.92] sm:text-7xl">
              Ready to be <span className="text-steel">boldly seen?</span>
            </h2>
            <p className="mt-5 max-w-md text-lg text-mist/80">
              Tell us what you have in mind. We&rsquo;ll reply within one business day with ideas, timing, and a quote.
            </p>
            <p className="mt-8 font-typewriter text-sm text-mist/60">
              Already a client?{" "}
              <Link href="/account" className="text-white underline underline-offset-4">Open your rooms</Link>
            </p>
          </div>
          <LeadForm />
        </div>
      </section>

      <footer className="bg-ink pb-[calc(2rem+env(safe-area-inset-bottom))] text-mist/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 border-t border-white/10 px-5 pt-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="font-typewriter text-xs">
            © {new Date().getFullYear()} {brand.legalName} · {brand.city} · Kindly put. Boldly seen.
          </p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white">Terms of Service</Link>
            <Link href="/account" className="hover:text-white">Client login</Link>
            <Link href="/login" className="hover:text-white">Studio</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
