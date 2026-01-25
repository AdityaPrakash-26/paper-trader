"use client";

import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setStatus(error.message);
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setStatus(error.message);
        } else {
          setStatus("Account created. Check your email to confirm.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-20 w-full max-w-md px-6">
      <div className="glass-panel rounded-3xl p-8">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
            Paper Trader
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">
            Build your portfolio without real money.
          </h1>
          <p className="text-sm text-slate-500">
            Practice stock trading with real market data and a simulated balance.
          </p>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm text-slate-600">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:border-teal-600 focus:outline-none"
              required
            />
          </label>
          <label className="block text-sm text-slate-600">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:border-teal-600 focus:outline-none"
              required
            />
          </label>

          {status ? (
            <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
              {status}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Working..."
              : mode === "signin"
              ? "Sign in"
              : "Create account"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
          <span>{mode === "signin" ? "New here?" : "Already have an account?"}</span>
          <button
            type="button"
            className="font-semibold text-teal-700"
            onClick={() => {
              setStatus(null);
              setMode(mode === "signin" ? "signup" : "signin");
            }}
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
