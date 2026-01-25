"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import AuthForm from "@/components/AuthForm";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-sm text-slate-500">
        Loading...
      </div>
    );
  }

  if (!session) {
    return <AuthForm />;
  }

  return <Dashboard session={session} />;
}
