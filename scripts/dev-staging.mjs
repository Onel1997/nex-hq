import { spawn } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { parseEnv } from "node:util";

const requiredKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const stripeTestKeys = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_AUTOMATIC_TAX_ENABLED",
  "NEXT_PUBLIC_APP_URL",
  "STRIPE_PRICE_CREATOR_MONTHLY",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_STUDIO_MONTHLY",
  "STRIPE_PRICE_MAX_MONTHLY",
  "STRIPE_PRICE_TOP_UP_250",
  "STRIPE_PRICE_TOP_UP_500",
  "STRIPE_PRICE_TOP_UP_1000",
  "STRIPE_PRICE_TOP_UP_2500",
];

function projectRef(url) {
  const hostname = new URL(url).hostname;
  const [ref] = hostname.split(".");
  if (!ref || !hostname.endsWith(".supabase.co")) {
    throw new Error("Staging-ENV enthält keine gültige Supabase-Projekt-URL.");
  }
  return ref;
}

const stagingEnvironment = parseEnv(readFileSync("Staging-ENV", "utf8"));
for (const key of requiredKeys) {
  if (!stagingEnvironment[key]?.trim()) {
    throw new Error(`Staging-ENV fehlt: ${key}`);
  }
}

const ref = projectRef(stagingEnvironment.NEXT_PUBLIC_SUPABASE_URL);

// Staging-ENV is the explicit authority for this child process. This order is
// intentional: inherited or .env.local values must never win for a staging run.
const childEnvironment = { ...process.env, ...stagingEnvironment };
// Known billing authority must come from Staging-ENV only. Explicit empty
// values also prevent inherited shell or .env.local billing values from being
// used when a staging value is missing.
for (const key of stripeTestKeys) childEnvironment[key] = stagingEnvironment[key] ?? "";

console.info(`[Xeriano] Starte Next.js mit Supabase-Projekt ${ref}.`);
console.info("[Xeriano] Stripe Test-Konfiguration (nur Anwesenheit):");
for (const key of stripeTestKeys) {
  const present = Boolean(stagingEnvironment[key]?.trim());
  console.info(`  ${key}: ${present ? "vorhanden" : "fehlt"}`);
}
// Public NEXT_PUBLIC_* values are compiled into Next.js artifacts. Reusing a
// cache created for another Supabase project can therefore pair the wrong
// public project URL with the server credential. A staging boot starts clean.
if (!process.argv.includes("--help")) rmSync(".next", { recursive: true, force: true });
const child = spawn(
  process.execPath,
  ["./node_modules/next/dist/bin/next", "dev", ...process.argv.slice(2)],
  { env: childEnvironment, stdio: "inherit" },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
