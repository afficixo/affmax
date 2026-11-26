"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import Script from "next/script"
import { getDashboardPath } from "@/lib/auth/dashboard-path"
import PublicLayout from "@/components/layout/PublicLayout"
import { signupCountries } from "@/lib/signup-countries"
import {
  validateSignupFields,
  type SignupField,
  type SignupFieldErrors,
} from "@/lib/signup-validation"
import styles from "./Signup.module.css"

type TurnstileRenderOptions = {
  sitekey: string
  action: string
  theme: "dark"
  callback: (token: string) => void
  "error-callback": () => void
  "expired-callback": () => void
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileRenderOptions) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
  }
}

const signupFieldOrder: SignupField[] = [
  "firstName",
  "lastName",
  "email",
  "address",
  "city",
  "state",
  "zipcode",
  "country",
  "password",
  "confirmPassword",
  "verticals",
  "traffic",
  "terms",
]

const signupFieldIds: Record<SignupField, string> = {
  firstName: "firstName",
  lastName: "lastName",
  email: "inputEmail",
  address: "inputAddress",
  city: "inputCity",
  state: "inputState",
  zipcode: "inputZip",
  country: "inputCountry",
  password: "inputPassword",
  confirmPassword: "inputPassword2",
  verticals: "inputTrafficVerticals",
  traffic: "inputTrafficSource",
  terms: "gridCheck",
}

function FieldError({ field, message }: { field: SignupField; message?: string }) {
  if (!message) return null
  return <p id={`signup-${field}-error`} className={styles.fieldError}>{message}</p>
}

function buildUsername(email: string) {
  const local = email.split("@")[0] ?? "publisher"
  const cleaned = local.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 20) || "publisher"
  const suffix = Math.floor(1000 + Math.random() * 9000)
  return `${cleaned}${suffix}`
}

export default function SignupClient() {
  const router = useRouter()
  const turnstileSiteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY?.trim() ?? ""
  const turnstileContainerRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetRef = useRef<string | null>(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [zipcode, setZipcode] = useState("")
  const [country, setCountry] = useState("")
  const [skype, setSkype] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [verticals, setVerticals] = useState("")
  const [traffic, setTraffic] = useState("")
  const [hearAbout, setHearAbout] = useState("")
  const [agreed, setAgreed] = useState(false)
  const [referralCode, setReferralCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState("")
  const [turnstileError, setTurnstileError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({})
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [approvalPendingSuccess, setApprovalPendingSuccess] = useState(false)

  useEffect(() => {
    setReferralCode(new URLSearchParams(window.location.search).get("ref")?.trim() ?? "")
  }, [])

  useEffect(() => {
    setError("")
    setSuccess("")
    setApprovalPendingSuccess(false)
  }, [router])

  const countryName = useMemo(
    () => signupCountries.find((item) => item.code === country)?.name ?? country,
    [country]
  )

  const clearFieldError = (field: SignupField) => {
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const fieldErrorProps = (field: SignupField) => ({
    "aria-invalid": Boolean(fieldErrors[field]),
    "aria-describedby": fieldErrors[field] ? `signup-${field}-error` : undefined,
  })

  const renderTurnstile = useCallback(() => {
    const turnstile = window.turnstile
    const container = turnstileContainerRef.current
    if (!turnstileSiteKey || !container || turnstileWidgetRef.current) return
    if (!turnstile) {
      setTurnstileError("Cloudflare verification could not initialize. Please refresh and try again.")
      return
    }

    try {
      turnstileWidgetRef.current = turnstile.render(container, {
        sitekey: turnstileSiteKey,
        action: "signup",
        theme: "dark",
        callback: (token) => {
          setTurnstileToken(token)
          setTurnstileError("")
        },
        "expired-callback": () => {
          setTurnstileToken("")
          setTurnstileError("Verification expired. Please complete it again.")
        },
        "error-callback": () => {
          setTurnstileToken("")
          setTurnstileError("Cloudflare verification failed to load. Please try again.")
        },
      })
    } catch (renderError) {
      console.error("Could not initialize Cloudflare Turnstile:", renderError)
      setTurnstileError("Cloudflare verification failed to load. Please refresh and try again.")
    }
  }, [turnstileSiteKey])

  const resetTurnstile = useCallback(() => {
    setTurnstileToken("")
    if (turnstileWidgetRef.current) {
      window.turnstile?.reset(turnstileWidgetRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (turnstileWidgetRef.current) {
        window.turnstile?.remove(turnstileWidgetRef.current)
      }
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    setTurnstileError("")

    const validationErrors = validateSignupFields({
      firstName,
      lastName,
      email,
      address,
      city,
      state,
      zipcode,
      country,
      password,
      confirmPassword,
      verticals,
      traffic,
      agreed,
      skype,
      hearAbout,
      referralCode,
    })
    setFieldErrors(validationErrors)
    const firstInvalidField = signupFieldOrder.find((field) => validationErrors[field])
    if (firstInvalidField) {
      window.requestAnimationFrame(() => {
        document.getElementById(signupFieldIds[firstInvalidField])?.focus()
      })
      return
    }
    if (!turnstileToken) {
      setTurnstileError(
        turnstileSiteKey
          ? "Please complete the Cloudflare verification before continuing."
          : "Cloudflare verification is not configured. Please try again later."
      )
      turnstileContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }

    setLoading(true)

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
    const fullAddress = [address.trim(), city.trim(), state.trim(), zipcode.trim(), countryName]
      .filter(Boolean)
      .join(", ")
    const contractDigits = zipcode.replace(/\D/g, "") || String(Date.now()).slice(-8)
    const sourceParts = [verticals.trim(), traffic.trim(), hearAbout.trim()].filter(Boolean)

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          address: fullAddress,
          contractNumber: contractDigits,
          username: buildUsername(email),
          email,
          password,
          referralCode,
          telegramUsername: skype.trim() || undefined,
          source: sourceParts.join(" | ") || undefined,
          turnstileToken,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Signup failed")
      }

      if (data?.requiresApproval) {
        setApprovalPendingSuccess(true)
        setSuccess("Account created. Your publisher account is under review. You can sign in once it is approved.")
        return
      }

      setSuccess("Account created. Redirecting you to your dashboard...")
      window.setTimeout(() => {
        router.push(getDashboardPath(data?.user?.role))
      }, 500)
    } catch (submitError) {
      setSuccess("")
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We could not create your account. Check your details and try again."
      )
      resetTurnstile()
    } finally {
      setLoading(false)
    }
  }

  return (
    <PublicLayout className="!bg-white" headerVariant="none" footerVariant="auth">
      <main className={styles.page}>
        <div className={styles.container}>
          <Link href="/#home" className={styles.logoLink} aria-label="Crack Bounty home">
            <Image
              src="/favicon.png"
              alt=""
              width={768}
              height={768}
              sizes="64px"
              className={styles.logo}
              preload
            />
          </Link>
          <h1 className={styles.title}>Publisher Sign Up</h1>
          {referralCode ? (
            <p className={styles.referralNote}>
              You were invited by a publisher. Your account will be linked to their referral.
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            {error ? (
              <div role="alert" className={styles.alert}>
                {error}
              </div>
            ) : null}

            {success ? (
              <div
                role="status"
                aria-live="polite"
                className={`${styles.alert} ${styles.alertSuccess}`}
              >
                {approvalPendingSuccess
                  ? "Account created. Your publisher account is pending manager approval."
                  : success}
              </div>
            ) : null}

            <h5 className={styles.sectionTitle}>Personal details</h5>

            <div className={styles.formRow}>
              <div className={`${styles.formGroup} ${styles.col6}`}>
                <input
                  id="firstName"
                  name="first_name"
                  type="text"
                  className={styles.control}
                  placeholder="First Name"
                  value={firstName}
                  {...fieldErrorProps("firstName")}
                  onChange={(event) => {
                    setFirstName(event.target.value)
                    clearFieldError("firstName")
                  }}
                  required
                  disabled={loading}
                  autoComplete="given-name"
                />
                <FieldError field="firstName" message={fieldErrors.firstName} />
              </div>
              <div className={`${styles.formGroup} ${styles.col6}`}>
                <input
                  id="lastName"
                  name="last_name"
                  type="text"
                  className={styles.control}
                  placeholder="Last Name"
                  value={lastName}
                  {...fieldErrorProps("lastName")}
                  onChange={(event) => {
                    setLastName(event.target.value)
                    clearFieldError("lastName")
                  }}
                  required
                  disabled={loading}
                  autoComplete="family-name"
                />
                <FieldError field="lastName" message={fieldErrors.lastName} />
              </div>
            </div>

            <div className={styles.formGroupFlush}>
              <input
                id="inputEmail"
                name="email"
                type="email"
                className={styles.control}
                placeholder="E-mail"
                value={email}
                maxLength={254}
                {...fieldErrorProps("email")}
                onChange={(event) => {
                  setEmail(event.target.value)
                  clearFieldError("email")
                }}
                required
                disabled={loading}
                autoComplete="email"
              />
              <FieldError field="email" message={fieldErrors.email} />
            </div>

            <div className={styles.formRow}>
              <div className={`${styles.formGroup} ${styles.col8}`}>
                <input
                  id="inputAddress"
                  name="address"
                  type="text"
                  className={styles.control}
                  placeholder="Address"
                  value={address}
                  {...fieldErrorProps("address")}
                  onChange={(event) => {
                    setAddress(event.target.value)
                    clearFieldError("address")
                  }}
                  required
                  disabled={loading}
                  autoComplete="street-address"
                />
                <FieldError field="address" message={fieldErrors.address} />
              </div>
              <div className={`${styles.formGroup} ${styles.col4}`}>
                <input
                  id="inputCity"
                  name="city"
                  type="text"
                  className={styles.control}
                  placeholder="City"
                  value={city}
                  {...fieldErrorProps("city")}
                  onChange={(event) => {
                    setCity(event.target.value)
                    clearFieldError("city")
                  }}
                  required
                  disabled={loading}
                  autoComplete="address-level2"
                />
                <FieldError field="city" message={fieldErrors.city} />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={`${styles.formGroup} ${styles.col4}`}>
                <input
                  id="inputState"
                  name="state"
                  type="text"
                  className={styles.control}
                  placeholder="State"
                  value={state}
                  {...fieldErrorProps("state")}
                  onChange={(event) => {
                    setState(event.target.value)
                    clearFieldError("state")
                  }}
                  required
                  disabled={loading}
                  autoComplete="address-level1"
                />
                <FieldError field="state" message={fieldErrors.state} />
              </div>
              <div className={`${styles.formGroup} ${styles.col4}`}>
                <input
                  id="inputZip"
                  name="zipcode"
                  type="text"
                  className={styles.control}
                  placeholder="ZIP Code"
                  value={zipcode}
                  {...fieldErrorProps("zipcode")}
                  onChange={(event) => {
                    setZipcode(event.target.value)
                    clearFieldError("zipcode")
                  }}
                  required
                  disabled={loading}
                  autoComplete="postal-code"
                />
                <FieldError field="zipcode" message={fieldErrors.zipcode} />
              </div>
              <div className={`${styles.formGroup} ${styles.col4}`}>
                <select
                  id="inputCountry"
                  name="country"
                  className={`${styles.select}${country ? ` ${styles.selectHasValue}` : ""}`}
                  value={country}
                  {...fieldErrorProps("country")}
                  onChange={(event) => {
                    setCountry(event.target.value)
                    clearFieldError("country")
                  }}
                  required
                  disabled={loading}
                  aria-label="Select country"
                >
                  <option value="">Select country</option>
                  {signupCountries.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <FieldError field="country" message={fieldErrors.country} />
              </div>
            </div>

            <div className={styles.formGroupFlush}>
              <input
                id="inputSkype"
                name="skype"
                type="text"
                className={styles.control}
                placeholder="Teams ID (Skype) or Telegram"
                value={skype}
                onChange={(event) => setSkype(event.target.value)}
                disabled={loading}
                autoComplete="nickname"
              />
            </div>

            <div className={styles.formRow}>
              <div className={`${styles.formGroup} ${styles.col6}`}>
                <input
                  id="inputPassword"
                  name="pass"
                  type="password"
                  className={styles.control}
                  placeholder="Password"
                  value={password}
                  {...fieldErrorProps("password")}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    clearFieldError("password")
                    clearFieldError("confirmPassword")
                  }}
                  required
                  disabled={loading}
                  autoComplete="new-password"
                />
                <FieldError field="password" message={fieldErrors.password} />
              </div>
              <div className={`${styles.formGroup} ${styles.col6}`}>
                <input
                  id="inputPassword2"
                  name="pass_repeat"
                  type="password"
                  className={styles.control}
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  {...fieldErrorProps("confirmPassword")}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value)
                    clearFieldError("confirmPassword")
                  }}
                  required
                  disabled={loading}
                  autoComplete="new-password"
                />
                <FieldError field="confirmPassword" message={fieldErrors.confirmPassword} />
              </div>
            </div>

            <h5 className={styles.sectionTitle}>Traffic information</h5>

            <div className={styles.formRow}>
              <div className={`${styles.formGroup} ${styles.col12}`}>
                <textarea
                  id="inputTrafficVerticals"
                  name="verticals"
                  rows={2}
                  className={styles.textarea}
                  placeholder="What niches/verticals are you interested in?"
                  value={verticals}
                  {...fieldErrorProps("verticals")}
                  onChange={(event) => {
                    setVerticals(event.target.value)
                    clearFieldError("verticals")
                  }}
                  required
                  disabled={loading}
                />
                <FieldError field="verticals" message={fieldErrors.verticals} />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={`${styles.formGroup} ${styles.col12}`}>
                <textarea
                  id="inputTrafficSource"
                  name="traffic"
                  rows={2}
                  className={styles.textarea}
                  placeholder="Describe your traffic sources and promotion methods"
                  value={traffic}
                  {...fieldErrorProps("traffic")}
                  onChange={(event) => {
                    setTraffic(event.target.value)
                    clearFieldError("traffic")
                  }}
                  required
                  disabled={loading}
                />
                <FieldError field="traffic" message={fieldErrors.traffic} />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={`${styles.formGroup} ${styles.col12}`}>
                <input
                  id="inputHearAboutUs"
                  name="hearabout"
                  type="text"
                  className={styles.control}
                  placeholder="How did you hear about us? (optional)"
                  value={hearAbout}
                  onChange={(event) => setHearAbout(event.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className={styles.formGroupFlush}>
              <div className={styles.checkboxWrap}>
                <input
                  className={styles.checkbox}
                  type="checkbox"
                  id="gridCheck"
                  checked={agreed}
                  {...fieldErrorProps("terms")}
                  onChange={(event) => {
                    setAgreed(event.target.checked)
                    clearFieldError("terms")
                  }}
                  required
                  disabled={loading}
                />
                <label className={styles.checkboxLabel} htmlFor="gridCheck">
                  I confirm that I have read, understand and agree to the{" "}
                  <Link href="/terms" target="_blank">
                    Terms and Conditions
                  </Link>
                  , and{" "}
                  <Link href="/privacy" target="_blank">
                    Privacy Policy
                  </Link>{" "}
                  of Crack Bounty LLC.
                </label>
              </div>
              <FieldError field="terms" message={fieldErrors.terms} />
            </div>

            <div className={styles.captcha} aria-live="polite">
              {turnstileSiteKey ? (
                <>
                  <Script
                    src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                    strategy="afterInteractive"
                    onReady={renderTurnstile}
                    onError={() => setTurnstileError("Cloudflare verification failed to load. Please try again.")}
                  />
                  <div ref={turnstileContainerRef} className={styles.turnstileWidget} />
                </>
              ) : (
                <p className={styles.alertError} role="status">
                  Cloudflare verification is not configured. Please contact support.
                </p>
              )}
            </div>
            {turnstileError ? (
              <p id="signup-captcha-error" className={styles.alertError} role="alert">
                {turnstileError}
              </p>
            ) : null}

            <button type="submit" name="btn-join" value="1" className={styles.submit} disabled={loading}>
              {loading ? "…" : "Next"}
            </button>
          </form>
        </div>
      </main>
    </PublicLayout>
  )
}
