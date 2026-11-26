const siteverifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

export type TurnstileVerificationResult =
  | { status: "verified" }
  | { status: "rejected" }
  | { status: "unavailable"; error: unknown }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export async function verifyCloudflareTurnstile(
  token: string,
  secret: string
): Promise<TurnstileVerificationResult> {
  let response: Response
  try {
    response = await fetch(siteverifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    })
  } catch (error) {
    return { status: "unavailable", error }
  }

  if (!response.ok) {
    return {
      status: "unavailable",
      error: new Error(`Cloudflare Siteverify returned HTTP ${response.status}`),
    }
  }

  let result: unknown
  try {
    result = await response.json()
  } catch (error) {
    return { status: "unavailable", error }
  }

  if (!isRecord(result)) {
    return {
      status: "unavailable",
      error: new Error("Cloudflare Siteverify returned an invalid response"),
    }
  }

  return result.success === true && result.action === "signup"
    ? { status: "verified" }
    : { status: "rejected" }
}
