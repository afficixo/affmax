"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getDashboardPath } from "@/lib/auth/dashboard-path";
import PublicLayout from "@/components/layout/PublicLayout";
import { AlertCircle } from "lucide-react";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isActive = true;

    const restoreSession = async () => {
      try {
        const hasToken = typeof document !== 'undefined' && document.cookie.split(';').some((cookie) => cookie.trim().startsWith('auth-token='));
        if (!hasToken) return;

        const response = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });
        if (!isActive || !response.ok) return;

        const user = await response.json();
        if (!user?.authenticated || !user?.role) return;
        router.replace(getDashboardPath(user.role));
      } catch (error) {
        console.error("Session check failed:", error);
      }
    };

    void restoreSession();
    return () => {
      isActive = false;
    };
  }, [router]);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    const successParam = searchParams.get("success");
    const approvalPending = searchParams.get("approval_pending") === "1";

    if (errorParam === "google_auth_failed") {
      setError("Google sign-in could not be completed. Try again or sign in with your username and password.");
    } else if (errorParam === "missing_code") {
      setError("Google returned an incomplete sign-in response. Please try again.");
    } else if (errorParam === "google_account_not_found") {
      setError("No account was found for that Google email. Sign up first or use another sign-in method.");
    } else if (approvalPending) {
      setError("Unable to sign in. Please contact support.");
    } else {
      setError("");
    }

    if (successParam === "google-authenticated") {
      router.replace(getDashboardPath(null));
    }
  }, [router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error(`The sign-in service returned an unexpected response (HTTP ${response.status}). Please try again.`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(response.status === 403
          ? "Unable to sign in. Please contact support."
          : data.error || "Login failed");
      }

      router.replace(getDashboardPath(data?.user?.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not sign you in. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout className="public-site-light" headerVariant="none" footerVariant="none">
      <main className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-[#070c15] px-4 py-10 sm:px-6">
        <div aria-hidden="true" className="absolute inset-0">
          <Image
            src="/publishers-image.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover grayscale opacity-45"
            preload
          />
        </div>
        <div aria-hidden="true" className="absolute inset-0 bg-[#070c15]/75" />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.42) 0.6px, transparent 0.7px)",
            backgroundSize: "4px 4px",
          }}
        />
        <div className="relative z-10 w-full max-w-[360px]">
          <Link
            href="/#home"
            className="mb-6 inline-flex w-full justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8aff70]"
          >
            <Image
              src="/logo.png"
              alt="Crack Bounty"
              width={2172}
              height={724}
              sizes="180px"
              className="h-12 w-[180px] object-contain"
              preload
            />
          </Link>
          <h1 className="mb-6 text-center text-lg font-semibold tracking-wide text-white">
            Publisher Login
          </h1>

          {error && (
            <div
              role="alert"
              className="mb-4 overflow-hidden rounded-sm border border-red-300/40 bg-red-950/70 text-red-100"
            >
              <div className="flex items-start gap-3 p-3">
                <div className="mt-0.5">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-5">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="overflow-hidden rounded-sm border border-[#dbe2e8] bg-white">
              <div>
              <label htmlFor="login-username" className="sr-only">
                E-mail
              </label>
              <input
                id="login-username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 w-full border-0 border-b border-[#dbe2e8] bg-white px-3 text-sm text-[#263238] placeholder:text-[#74818a] outline-none transition focus:ring-2 focus:ring-inset focus:ring-[#5ff442]/40"
                placeholder="E-mail"
                autoComplete="username"
                required
                disabled={loading}
              />
              </div>
              <div>
              <label htmlFor="login-password" className="sr-only">
                Password
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full border-0 bg-white px-3 text-sm text-[#263238] placeholder:text-[#74818a] outline-none transition focus:ring-2 focus:ring-inset focus:ring-[#5ff442]/40"
                placeholder="Password"
                autoComplete="current-password"
                required
                disabled={loading}
              />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-12 w-full items-center justify-center rounded-sm bg-[#5ff442] px-5 py-2.5 text-sm font-semibold text-[#10243b] transition-colors hover:bg-[#4dd935] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8aff70] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070c15] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>

            <div className="flex flex-col items-center gap-2 pt-1 text-sm">
              <Link
                href="/signup"
                className="text-white/75 transition-colors hover:text-[#8aff70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8aff70]"
              >
                Don&apos;t have an account? <span className="font-semibold text-white">Sign up</span>
              </Link>
              <a
                href="#forgot-password"
                className="text-white/75 transition-colors hover:text-[#8aff70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8aff70]"
              >
                Forgot Password?
              </a>
            </div>
          </form>
        </div>
      </main>
    </PublicLayout>
  );
}
