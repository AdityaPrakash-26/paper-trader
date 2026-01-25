"use client";

import { supabase } from "@/lib/supabaseClient";

export default function AccountCard({ email }: { email: string }) {
  return (
    <div className="glass-panel rounded-3xl p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Account</p>
      <p className="mt-3 text-sm text-slate-700">Signed in as</p>
      <p className="mt-1 text-sm font-semibold text-slate-900 break-all">{email}</p>
      <button
        onClick={() => supabase.auth.signOut()}
        className="mt-6 w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
      >
        Sign out
      </button>
    </div>
  );
}
