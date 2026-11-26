import assert from "node:assert/strict"
import { test } from "node:test"
import { verifyCloudflareTurnstile } from "../src/lib/cloudflare-turnstile"

test("validates the token with Cloudflare and requires the signup action", async () => {
  const originalFetch = globalThis.fetch
  let submittedBody: BodyInit | null | undefined
  globalThis.fetch = async (input, init) => {
    assert.equal(input, "https://challenges.cloudflare.com/turnstile/v0/siteverify")
    submittedBody = init?.body
    return Response.json({ success: true, action: "signup" })
  }

  try {
    const result = await verifyCloudflareTurnstile("test-token", "test-secret")
    assert.deepEqual(result, { status: "verified" })
    assert.ok(submittedBody instanceof URLSearchParams)
    assert.equal(submittedBody.get("secret"), "test-secret")
    assert.equal(submittedBody.get("response"), "test-token")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("rejects invalid tokens and tokens issued for a different action", async (t) => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => Response.json({ success: false })

  try {
    await t.test("rejects a failed Cloudflare response", async () => {
      assert.deepEqual(
        await verifyCloudflareTurnstile("invalid-token", "test-secret"),
        { status: "rejected" }
      )
    })

    globalThis.fetch = async () => Response.json({ success: true, action: "login" })
    await t.test("rejects a token for another action", async () => {
      assert.deepEqual(
        await verifyCloudflareTurnstile("login-token", "test-secret"),
        { status: "rejected" }
      )
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("reports Cloudflare outages as unavailable", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error("network unavailable")
  }

  try {
    const result = await verifyCloudflareTurnstile("test-token", "test-secret")
    assert.equal(result.status, "unavailable")
  } finally {
    globalThis.fetch = originalFetch
  }
})
