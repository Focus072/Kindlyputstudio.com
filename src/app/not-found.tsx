import Link from "next/link";
import { brand } from "@/config/brand";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#070B16] px-6 text-center text-white">
      <p className="font-typewriter text-sm text-white/50">404</p>
      <h1 className="mt-3 font-display text-5xl uppercase">Nothing here</h1>
      <p className="mt-4 max-w-sm text-white/60">
        This link does not match any delivery room. Double check the link {brand.name} sent you.
      </p>
      <Link href="/" className="mt-8 rounded-full border border-white/15 px-5 py-2.5 text-sm hover:bg-white/10">
        Go home
      </Link>
    </main>
  );
}
