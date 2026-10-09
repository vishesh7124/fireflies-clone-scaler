"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, LockIcon, SparklesIcon, StarIcon } from "lucide-react";
import { toast } from "sonner";
import { isAuthed, signIn } from "@/lib/auth";
import { Logo } from "@/components/layout/logo";

/** Google "G" mark. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.2-2.1 3.7-5.1 3.7-8.6z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.9-5l-4 3.1C5.1 21.3 8.3 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.1 14.4c-.3-.8-.4-1.6-.4-2.4s.1-1.7.4-2.4l-4-3.1C.4 8.2 0 10 0 12s.4 3.8 1.1 5.4l4-3z"
      />
      <path
        fill="#EA4335"
        d="M12 4.7c2.3 0 3.9 1 4.8 1.8l3.5-3.4C18 1.2 15.2 0 12 0 8.3 0 5.1 2.7 1.1 6.6l4 3.1c1-2.9 3.7-5 6.9-5z"
      />
    </svg>
  );
}

/** Microsoft four-square mark. */
function MicrosoftIcon() {
  return (
    <span className="grid size-5 shrink-0 grid-cols-2 gap-[2px]" aria-hidden="true">
      <span className="bg-[#f25022]" />
      <span className="bg-[#7fba00]" />
      <span className="bg-[#00a4ef]" />
      <span className="bg-[#ffb900]" />
    </span>
  );
}

/** Sign in with the chosen method (any works — mock auth). */
function useMockSignIn() {
  const router = useRouter();
  return (method: string) => {
    signIn();
    toast.success("Welcome back, VISHESH!");
    router.replace("/");
    void method; // method is cosmetic in the mock
  };
}

/**
 * Login replica — the real Fireflies sign-in screen: headline + social
 * buttons + compliance chips on the left, product mockup + testimonial on
 * the right (docs/01 §5.1).
 */
export default function LoginPage() {
  const router = useRouter();
  const signInWith = useMockSignIn();

  useEffect(() => {
    if (isAuthed()) router.replace("/");
  }, [router]);

  return (
    <div className="grid min-h-dvh bg-background text-foreground lg:grid-cols-2">
      {/* left — auth */}
      <div className="mx-auto flex w-full max-w-md flex-col justify-center gap-8 px-8 py-16">
        <div className="flex items-center gap-2.5">
          <Logo className="size-9" />
          <span className="text-lg font-medium tracking-tight">fireflies.ai</span>
        </div>

        <div className="space-y-3">
          <h1 className="font-display text-3xl font-semibold leading-tight text-foreground">
            Get the #1 AI Assistant for Your Meetings
          </h1>
          <p className="text-xs leading-relaxed text-muted-foreground">
            By clicking &ldquo;Continue&rdquo;, you agree to our{" "}
            <span className="text-primary-soft">Terms of Service</span>, acknowledge our{" "}
            <span className="text-primary-soft">Privacy Policy</span> and consent to
            Fireflies recording and using your voice data to provide Fireflies&rsquo;
            services.
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => signInWith("google")}
            className="flex h-11 w-full items-center gap-3 rounded-lg border border-border bg-elevated px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <GoogleIcon />
            Continue with Google
            <ArrowRightIcon className="ml-auto size-4 text-success" />
          </button>
          <button
            type="button"
            onClick={() => signInWith("microsoft")}
            className="flex h-11 w-full items-center gap-3 rounded-lg border border-border bg-elevated px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <MicrosoftIcon />
            Continue with Microsoft
            <ArrowRightIcon className="ml-auto size-4 text-success" />
          </button>
          <button
            type="button"
            onClick={() => signInWith("sso")}
            className="w-full py-1 text-center text-sm text-primary-soft hover:underline"
          >
            Use Single Sign-On
          </button>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-[10px] font-medium tracking-widest text-subtle">
          <LockIcon className="size-3 text-success" />
          SOC 2 TYPE II · GDPR · HIPAA · 256-BIT ENCRYPTION
        </p>
      </div>

      {/* right — product mockup + testimonial (static, replicates the real login) */}
      <div className="hidden flex-col items-center justify-center gap-6 border-l border-border bg-surface/40 px-12 lg:flex">
        <div className="w-80 space-y-4 rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <Logo variant="mark" className="size-9 rounded-lg" />
            <div>
              <p className="text-sm font-medium text-foreground">Marketing Sync</p>
              <p className="text-xs text-subtle">Jan 15, 11:30 AM</p>
            </div>
            <span className="ml-auto flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
              <span className="size-1.5 rounded-full bg-destructive" /> REC
            </span>
          </div>

          <div className="space-y-1.5 rounded-lg bg-elevated/60 p-3">
            <p className="text-xs font-medium text-foreground">
              Priorities <span className="text-primary-soft">00:00 - 10:12</span>
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              • Ensure clarity on messaging, target audience, and primary channels
            </p>
            <div className="h-1 w-full overflow-hidden rounded-full bg-border">
              <div className="h-full w-2/5 rounded-full bg-primary" />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {["Slack", "Gmail", "Fireflies"].map((app) => (
              <span
                key={app}
                className="rounded-full border border-border bg-elevated px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {app}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-elevated p-2.5">
            <SparklesIcon className="size-3.5 text-primary-soft" />
            <span className="text-xs text-subtle">List out all the tasks for the new website.</span>
            <span className="ml-auto flex size-7 items-center justify-center rounded-full bg-primary">
              <ArrowRightIcon className="size-3.5 rotate-[-45deg] text-white" />
            </span>
          </div>
        </div>

        <div className="w-80 space-y-2 rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Vercel</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <StarIcon className="size-3 fill-warning text-warning" /> 4.8 / 5
            </span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            &ldquo;Fireflies keeps me 100% present in meetings without losing any of the
            details.&rdquo;
          </p>
          <p className="text-xs text-subtle">Sarup Banskota · Head of Growth</p>
        </div>
      </div>
    </div>
  );
}
