import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveServerNexhqAuthentication } from "@/lib/auth/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const authentication = await resolveServerNexhqAuthentication();
  if (authentication.authenticated) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <section className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/70 p-7 shadow-2xl shadow-black/20 backdrop-blur">
        <div className="mb-7">
          <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 font-display text-lg font-semibold text-foreground">
            N
          </div>
          <h1 className="font-display text-2xl font-medium tracking-tight">
            NexHQ
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Private owner access
          </p>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}

