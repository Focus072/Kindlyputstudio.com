import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Camera, CheckCircle2, Clapperboard, Download, MapPin, MessageCircle, Sparkles, UserRound } from "lucide-react";
import { brand } from "@/config/brand";
import { LeadForm } from "@/components/landing/LeadForm";
import { RoomMockup } from "@/components/landing/RoomMockup";
import { Showcase } from "@/components/landing/Showcase";
import { Eyebrow } from "@/components/landing/Eyebrow";
import { Reveal } from "@/components/landing/Reveal";
import { Swoosh } from "@/components/landing/Swoosh";
import { TryRoom } from "@/components/landing/TryRoom";
import { listShowcase } from "@/lib/showcase";

export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: `${brand.name} · Photo & video for Bakersfield businesses` },
  description:
    "Kindly Put Studio shoots photo and video for Bakersfield businesses and delivers every file in a private, branded room you can approve and download from.",
  alternates: { canonical: "/" },
  openGraph: {
    title: `${brand.name} · Kindly put. Boldly seen.`,
    description: "Photo and video for Bakersfield businesses, delivered in a private branded room.",
    type: "website",
    url: "/",
    siteName: brand.name,
  },
};

// Tells Google this is a local business in Bakersfield (helps local search and Maps).
const businessJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: brand.name,
  slogan: brand.tagline,
  url: brand.siteUrl,
  logo: `${brand.siteUrl}${brand.logo.full}`,
  image: `${brand.siteUrl}/opengraph-image.png`,
  description: "Photo, video, and social content for Bakersfield businesses.",
  areaServed: { "@type": "City", name: "Bakersfield" },
  address: { "@type": "PostalAddress", addressLocality: "Bakersfield", addressRegion: "CA", addressCountry: "US" },
  knowsAbout: ["Photography", "Videography", "Social media content", "Short-form video"],
};

const services = [
  { icon: Camera, title: "Photography", body: "Products, storefronts, teams, menus, and cars. Edited, color matched, and ready for web, print, and social." },
  { icon: Clapperboard, title: "Video & reels", body: "Short-form vertical video built for Instagram and TikTok, plus longer brand pieces for your site." },
  { icon: Sparkles, title: "Content days", body: "One planned shoot that fills your feed for the month: photos, reels, and behind the scenes in a single visit." },
];

const ticker = ["Photo", "Video", "Reels", "Content days", "Delivery rooms", "Bakersfield, CA"];

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
  // Photos for the "try it" room: prefer ones not already in the hero mockup.
  const tryPool = shoots.flatMap((s, k) => s.photos.slice(k === 0 ? 7 : 0).map((p) => p.thumb));
  const tryPhotos = (tryPool.length >= 3 ? tryPool : shoots.flatMap((s) => s.photos.map((p) => p.thumb))).slice(0, 3);
  const navLink =
    "relative hidden rounded-full px-3 py-2 text-slate-600 transition-colors hover:text-ink md:inline after:absolute after:inset-x-3 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-300 hover:after:scale-x-100";

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#F4F5F6] text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd).replace(/</g, "\\u003c") }}
      />
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-[#F4F5F6]/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/" className="group flex items-center gap-3" aria-label={`${brand.name} home`}>
            <img src={brand.logo.mark} alt="" className="h-9 w-auto transition-transform duration-500 group-hover:-rotate-6" />
            <span className="hidden text-[11px] font-bold uppercase tracking-[0.28em] sm:inline">{brand.name}</span>
          </Link>
          <div className="flex items-center gap-1 text-sm font-semibold sm:gap-2">
            <a href="#work" className={navLink}>Work</a>
            <a href="#services" className={navLink}>Services</a>
            <a href="#rooms" className={navLink}>Delivery rooms</a>
            <Link href="/account" className="rounded-full px-3 py-2 text-slate-600 transition-colors hover:text-ink">Client login</Link>
            <a href="#start" className="rounded-full bg-ink px-4 py-2.5 text-white transition-colors hover:bg-slate-brand">Start a project</a>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="kp-grain relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(182,195,200,0.55),transparent)]" />
        <Swoosh className="absolute -left-40 top-24 hidden w-[520px] text-steel opacity-70 md:block lg:-left-24 lg:w-[620px]" flip />
        <Swoosh className="absolute -right-40 top-10 hidden w-[520px] text-steel opacity-70 md:block lg:-right-24 lg:w-[620px]" />
        <div className="relative z-10 mx-auto max-w-6xl px-5 pb-10 pt-12 text-center sm:px-8 sm:pt-20">
          <p className="kp-rise inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 py-1.5 font-typewriter text-[11px] whitespace-nowrap text-slate-600 sm:text-xs">
            <span className="relative flex size-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-approve opacity-60" />
              <span className="relative size-1.5 rounded-full bg-approve" />
            </span>
            Photo · Video · Content · {brand.city}
          </p>
          <h1 className="mx-auto mt-6 max-w-4xl font-display text-[clamp(3.4rem,13vw,8.5rem)] uppercase leading-[0.88] tracking-[-0.01em]">
            <span className="kp-rise inline-block" style={{ animationDelay: "80ms" }}>Kindly</span>{" "}
            <span className="kp-rise inline-block" style={{ animationDelay: "180ms" }}>put.</span>
            <br />
            <span className="relative inline-block px-2">
              <span className="kp-swipe absolute inset-x-0 bottom-[0.08em] top-[0.18em] -z-0 rounded-md bg-steel" aria-hidden />
              <span className="kp-rise relative inline-block" style={{ animationDelay: "320ms" }}>Boldly</span>{" "}
              <span className="kp-rise relative inline-block" style={{ animationDelay: "420ms" }}>seen.</span>
            </span>
          </h1>
          <p className="kp-rise mx-auto mt-6 max-w-2xl text-lg text-slate-600 sm:text-xl" style={{ animationDelay: "550ms" }}>
            We shoot photo and video for Bakersfield businesses, then hand it over in a private room with your name on it.
            Approve, comment, and download in one place. No Drive folders. No lost emails.
          </p>
          <div className="kp-rise mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: "650ms" }}>
            <a href="#start" className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-7 py-4 text-sm font-bold text-white shadow-[0_14px_30px_-12px_rgba(29,43,50,0.6)] transition hover:bg-slate-brand sm:w-auto">
              Start a project <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a href="#rooms" className="inline-flex w-full items-center justify-center rounded-full border border-black/10 bg-white px-7 py-4 text-sm font-bold transition hover:border-ink sm:w-auto">
              Try a delivery room
            </a>
          </div>
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-6 sm:px-8 sm:pb-28">
          <RoomMockup
            cover={lead?.coverLarge ?? null}
            thumbs={lead ? lead.photos.slice(1, 7).map((p) => p.thumb) : []}
            client={lead?.client ?? "Your business"}
            title={lead?.label ?? "Spring launch shoot"}
            mark={brand.logo.markOnDark}
          />
        </div>
      </section>

      {/* Full-width work strip + word ticker */}
      <div className="relative">
        {strip.length > 4 && (
          <section aria-hidden className="relative overflow-hidden bg-ink py-4 pb-10 sm:pb-12">
            <div className="kp-marquee flex w-max gap-3">
              {[...strip, ...strip].map((src, i) => (
                <img key={i} src={src} alt="" loading="lazy" className="h-44 w-auto rounded-2xl object-cover sm:h-64" />
              ))}
            </div>
          </section>
        )}
        <div aria-hidden className={`relative z-10 overflow-hidden py-3 ${strip.length > 4 ? "-mt-7" : ""}`}>
          <div className="-mx-4 -rotate-[1.5deg] bg-steel py-3 shadow-[0_18px_40px_-20px_rgba(15,24,29,0.5)] sm:py-4">
            <div className="kp-ticker flex w-max items-center">
              {[0, 1, 2, 3].map((r) =>
                ticker.map((word, k) => (
                  <span key={`${r}-${k}`} className="flex items-center font-display text-3xl uppercase leading-none text-ink sm:text-5xl">
                    <span className={k % 2 ? "kp-outline-ink" : ""}>{word}</span>
                    <span className="mx-5 text-slate-brand sm:mx-8">✦</span>
                  </span>
                )),
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delivery rooms */}
      <section id="rooms" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-16">
          <Reveal>
            <Eyebrow n="01">Every project, delivered properly</Eyebrow>
            <h2 className="mt-4 font-display text-5xl uppercase leading-[0.92] sm:text-7xl">
              Your own <span className="text-slate-brand">delivery room</span>
            </h2>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              When your edits are ready, you get one clean link. It opens a room built for your shoot: your name, your
              photos, and a simple way to sign off.
            </p>
            <ul className="mt-8 grid gap-2 sm:grid-cols-2">
              {roomPerks.map(({ icon: Icon, text }) => (
                <li
                  key={text}
                  className="group flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink text-white transition-colors duration-300 group-hover:bg-slate-brand">
                    <Icon className="size-[18px]" />
                  </span>
                  <p className="text-pretty pt-1.5 text-[15px] font-semibold leading-snug">{text}</p>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.12} className="relative">
            <span aria-hidden className="absolute -right-3 -top-10 hidden rotate-6 font-typewriter text-sm text-slate-500 lg:block">
              go on, give it a try ↓
            </span>
            <TryRoom photos={tryPhotos} client={lead?.client ?? "Your business"} />
          </Reveal>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="relative scroll-mt-20 overflow-hidden bg-white py-20 sm:py-28">
        <span aria-hidden className="kp-outline-ink pointer-events-none absolute -right-6 top-6 hidden select-none font-display text-[16rem] uppercase leading-none opacity-[0.07] lg:block">
          Make
        </span>
        <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal>
            <Eyebrow n="02">What we make</Eyebrow>
            <h2 className="mt-4 font-display text-5xl uppercase leading-none sm:text-7xl">
              Services<span className="text-steel">.</span>
            </h2>
          </Reveal>
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {services.map(({ icon: Icon, title, body }, i) => (
              <Reveal
                as="li"
                key={title}
                delay={i * 0.08}
                className="group relative overflow-hidden rounded-[28px] bg-[#F4F5F6] p-6 ring-1 ring-black/5 transition-colors duration-500 hover:bg-ink hover:text-cloud sm:p-8"
              >
                <span aria-hidden className="kp-outline absolute right-5 top-4 font-display text-7xl leading-none text-black/10 transition-colors duration-500 group-hover:text-white/15">
                  0{i + 1}
                </span>
                <Icon className="relative size-7 text-slate-brand transition-colors duration-500 group-hover:text-steel" />
                <h3 className="relative mt-6 font-display text-3xl uppercase">{title}</h3>
                <p className="relative mt-2 text-pretty text-slate-600 transition-colors duration-500 group-hover:text-mist/80">{body}</p>
                <span className="relative mt-6 flex items-center gap-1.5 font-typewriter text-xs text-slate-500 transition-colors duration-500 group-hover:text-steel">
                  <a href="#start" className="after:absolute after:inset-0">Book this</a>
                  <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </Reveal>
            ))}
          </ul>

          <ol className="relative mt-16 grid gap-8 pt-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-black/10" />
            {steps.map((s, i) => (
              <Reveal as="li" key={s.n} delay={i * 0.1} className="relative">
                <span aria-hidden className="absolute -top-[45px] left-0 hidden size-[11px] rounded-full border-2 border-white bg-ink ring-1 ring-black/10 lg:block" />
                <span className="kp-outline-ink block font-display text-6xl leading-none">{s.n}</span>
                <h3 className="mt-3 font-display text-3xl uppercase">{s.title}</h3>
                <p className="mt-1 text-pretty text-slate-600">{s.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Work */}
      {shoots.length > 0 && (
        <section id="work" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
          <Reveal>
            <Eyebrow n="03">Recent work</Eyebrow>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <h2 className="font-display text-5xl uppercase leading-none sm:text-7xl">
                Shot in <span className="text-slate-brand">Bakersfield</span>
              </h2>
              <p className="flex items-center gap-1.5 pb-1 font-typewriter text-xs text-slate-500 sm:text-sm">
                <MapPin className="size-4 text-slate-brand" /> 35.3733° N · 119.0187° W
              </p>
            </div>
          </Reveal>
          <div className="mt-10">
            <Showcase shoots={shoots} />
          </div>
        </section>
      )}

      {/* Start a project */}
      <div className="kp-grain kp-grain-dark relative overflow-hidden bg-ink">
        <Swoosh className="absolute -right-32 -top-20 w-[460px] text-slate-brand opacity-70 sm:w-[640px]" />
        <Swoosh className="absolute -left-48 top-[38%] hidden w-[520px] rotate-180 text-slate-brand opacity-40 lg:block" />
        <section id="start" className="relative z-10 scroll-mt-16 text-cloud">
          <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <Reveal>
              <img src={brand.logo.markOnDark} alt="" className="h-12 w-auto" />
              <h2 className="mt-6 font-display text-5xl uppercase leading-[0.92] sm:text-7xl">
                Ready to be <span className="text-steel">boldly seen?</span>
              </h2>
              <p className="mt-5 max-w-md text-lg text-mist/80">
                Tell us what you have in mind. We&rsquo;ll reply within one business day with ideas, timing, and a quote.
              </p>
              <p className="mt-8 font-typewriter text-sm text-mist/60">
                Already a client?{" "}
                <Link href="/account" className="text-white underline underline-offset-4 hover:text-steel">Open your rooms</Link>
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <LeadForm />
            </Reveal>
          </div>
        </section>

        <footer className="relative z-10 pb-[calc(2rem+env(safe-area-inset-bottom))] text-mist/60">
          <p
            aria-hidden
            className="kp-outline pointer-events-none mx-auto max-w-6xl select-none whitespace-nowrap px-5 font-display text-[clamp(2.6rem,10.6vw,9.6rem)] uppercase leading-[0.85] text-white/15 sm:px-8"
          >
            Kindly put studio
          </p>
          <div className="mx-auto mt-8 max-w-6xl px-5 sm:px-8">
            <div className="flex flex-col gap-4 border-t border-white/10 pt-8 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="font-typewriter text-xs">
                © {new Date().getFullYear()} {brand.legalName} · {brand.city} · Kindly put. Boldly seen.
              </p>
              <nav className="grid grid-cols-2 gap-x-5 sm:flex sm:flex-wrap sm:gap-y-2">
                <Link href="/privacy" className="py-2 transition-colors hover:text-white sm:py-0">Privacy Policy</Link>
                <Link href="/terms" className="py-2 transition-colors hover:text-white sm:py-0">Terms of Service</Link>
                <Link href="/account" className="py-2 transition-colors hover:text-white sm:py-0">Client login</Link>
                <Link href="/login" className="py-2 transition-colors hover:text-white sm:py-0">Studio</Link>
              </nav>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
