"use client";

import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type NavbarProps = {
  session?: Session | null;
};

export default function Navbar({ session }: NavbarProps) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm">
      <Link href="/" className="text-sm font-semibold text-slate-900 hover:text-teal-700">
        Paper Trader
      </Link>
      {session ? (
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-slate-500 sm:inline">Signed in</span>
          <button
            onClick={handleSignOut}
            className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
      ) : (
        <Link
          href="/"
          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-teal-600 hover:text-teal-700"
        >
          Sign in
        </Link>
      )}
    </header>
  );
}
