"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
    <PublicLayout className="public-site-light" footerVariant="auth">
      <main className="flex flex-1 flex-col bg-white px-4 pb-16 pt-28 sm:px-6 md:pt-32">
        <div className="mx-auto w-full max-w-[520px]">
          <h1 className="mb-8 text-center font-[Montserrat] text-[28px] font-normal leading-tight text-[#58666e] sm:mb-10 sm:text-[32px]">
            Publisher Login
          </h1>

          {error && (
            <div
              role="alert"
              className="mb-4 overflow-hidden rounded border border-red-200 bg-red-50 text-red-800"
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
                className="w-full rounded-[3px] border border-[#c7cbcd] bg-[#f1f3f5] px-3 py-2.5 text-[17px] text-[#455964] placeholder-[#74818a] outline-none transition focus:border-[#17a2b8] focus:ring-2 focus:ring-[#17a2b8]/20"
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
                className="w-full rounded-[3px] border border-[#c7cbcd] bg-[#f1f3f5] px-3 py-2.5 text-[17px] text-[#455964] placeholder-[#74818a] outline-none transition focus:border-[#17a2b8] focus:ring-2 focus:ring-[#17a2b8]/20"
                placeholder="Password"
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[46px] w-full items-center justify-center rounded-[3px] bg-[#17a2b8] px-5 py-2.5 text-[17px] font-normal text-white transition-colors hover:bg-[#138496] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#17a2b8]/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Login"}
            </button>

            <div className="flex items-center justify-between gap-3 pt-1 text-[17px]">
              <Link href="/signup" className="text-[#007bff] hover:underline">
                Don&apos;t have an account?
              </Link>
              <a href="#forgot-password" className="text-[#007bff] hover:underline">
                Forgot Password?
              </a>
            </div>
          </form>
        </div>
      </main>
    </PublicLayout>
  );
}
