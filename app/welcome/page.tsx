"use client";
import Image from "next/image";
import Link from "next/link";

export default function Welcome() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-between p-6" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div />
      <div className="flex flex-col items-center gap-6">
        <Image src="/ekarihub-logo.png" alt="ekarihub" width={320} height={80} priority />
        <p className="text-center max-w-sm text-sm text-neutral-600">
          Connecting Communities, Growing Agribusiness Opportunities
        </p>
        <div className="w-full max-w-sm grid gap-3">
          <Link href="/signup" className="btn btn-primary w-full text-center">Sign Up</Link>
          <Link href="/login" className="btn w-full text-center border">Log In</Link>
          <Link href="/Deeds" className="text-center text-sm underline">Explore feed first</Link>
        </div>
      </div>
      <div className="text-xs text-neutral-500">
        By continuing you agree to our <Link href="#" className="underline">Terms</Link> & <Link href="#" className="underline">Privacy</Link>.
      </div>
    </main>
  );
}
