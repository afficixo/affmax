"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import PublicLayout from "@/components/layout/PublicLayout";
import {
  TrendingUp, Target, LineChart,
  ArrowRight, Layers, Headphones, Mail, MapPin, Check,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function HomePage() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "success">("idle");
  const [submitError, setSubmitError] = useState("");

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = "Please enter your first name.";
    if (!form.lastName.trim()) next.lastName = "Please enter your last name.";
    if (!form.email.trim()) next.email = "Please enter your e-mail.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) next.email = "Please enter a valid e-mail address.";
    if (!form.message.trim()) next.message = "Please write a short message.";
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;
    setStatus("sending");
    setSubmitError("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send your message. Please try again.");
      setStatus("success");
      setForm({ firstName: "", lastName: "", email: "", message: "" });
      window.setTimeout(() => setStatus("idle"), 4000);
    } catch (error) {
      setStatus("idle");
      setSubmitError(error instanceof Error ? error.message : "Unable to send your message. Please try again.");
    }
  };

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  return (
    <PublicLayout>
      <main>
        {/* HERO */}
        <section id="home" aria-labelledby="home-heading" className="relative isolate overflow-hidden bg-[#07152e] pt-28 pb-14 sm:pt-32 sm:pb-16 md:min-h-[690px] md:pt-36">
          <Image
            src="/hero-network-bg.svg?v=particle-reference-20261126"
            alt=""
            fill
            fetchPriority="high"
            sizes="100vw"
            unoptimized
            className="home-hero-background pointer-events-none object-cover object-[72%_44%]"
          />
          <div className="home-hero-overlay pointer-events-none absolute inset-0" aria-hidden="true" />

          <div className="home-hero-content relative mx-auto flex min-h-[500px] w-full max-w-7xl items-center px-4 py-6 text-left sm:min-h-[540px] sm:px-6 sm:py-8 lg:min-h-[560px] lg:px-8">
            <div className="max-w-[680px]">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
                className="home-hero-reveal relative mb-7 inline-flex items-center bg-[#df383e] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_8px_24px_rgba(0,0,0,0.2)] after:absolute after:left-5 after:top-full after:border-x-[9px] after:border-x-transparent after:border-t-[9px] after:border-t-[#df383e]"
              >
                Crack Bounty · Affiliate network
              </motion.div>

              <motion.h1
                id="home-heading"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.68, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="home-hero-reveal font-[Montserrat] mb-5 text-[2.55rem] font-black leading-[1.04] tracking-[-0.045em] text-white sm:mb-6 sm:text-5xl md:text-[3.6rem] lg:text-[4.15rem]"
              >
                Affiliate growth,
                <br />
                built for <span className="text-[#ff6268]">your goals.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="home-hero-reveal mb-7 max-w-xl text-[15px] leading-7 text-[#e1e8f2] sm:mb-8 sm:text-base md:text-[17px]"
              >
                Crack Bounty connects publishers and advertisers with quality campaigns,
                clear performance insights, and responsive support.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="home-hero-reveal mb-8 flex w-full flex-col items-stretch gap-3 sm:mb-9 sm:flex-row sm:items-center"
              >
                <Link
                  href="/signup"
                  prefetch={false}
                  className="group inline-flex min-h-12 w-full -skew-x-6 items-center justify-center rounded-none bg-[#5ff442] px-6 py-3 text-sm font-semibold text-[#10243b] shadow-[0_5px_14px_rgba(95,244,66,0.18)] transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-[#4dd935] hover:shadow-[0_8px_18px_rgba(95,244,66,0.26)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8aff70] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07152e] active:translate-y-0 sm:w-auto sm:min-w-[224px]"
                >
                  <span className="inline-flex skew-x-6 items-center gap-2.5">
                    Join the network
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
                <a
                  href="#contact"
                  className="group inline-flex min-h-12 w-full -skew-x-6 items-center justify-center rounded-none border border-[#5ff44266] bg-[rgba(16,36,59,0.68)] px-6 py-[11px] text-sm font-semibold text-white transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-[#5ff442] hover:bg-[rgba(95,244,66,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8aff70] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07152e] active:translate-y-0 sm:w-auto sm:min-w-[224px]"
                >
                  <span className="inline-flex skew-x-6 items-center gap-2.5">
                    Talk to our team
                    <ArrowRight
                      className="h-4 w-4 text-[#8aff70] transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
                className="home-hero-reveal grid max-w-[570px] grid-cols-1 gap-3 sm:grid-cols-2"
              >
                <a
                  href="#publishers"
                  className="group flex min-h-[76px] items-center justify-between gap-4 rounded-lg border border-[#ffffff29] bg-[#ffffff0d] px-4 py-3.5 text-left backdrop-blur-md transition-colors hover:border-[#ffffff66] hover:bg-[#ffffff17] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <span>
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#c2ccda]">For publishers</span>
                    <span className="mt-1 block text-sm font-semibold text-white">Find your next campaign</span>
                  </span>
                  <TrendingUp className="h-5 w-5 shrink-0 text-[#ff6268] transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </a>
                <a
                  href="#advertisers"
                  className="group flex min-h-[76px] items-center justify-between gap-4 rounded-lg border border-[#ffffff29] bg-[#ffffff0d] px-4 py-3.5 text-left backdrop-blur-md transition-colors hover:border-[#ffffff66] hover:bg-[#ffffff17] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <span>
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#c2ccda]">For advertisers</span>
                    <span className="mt-1 block text-sm font-semibold text-white">Grow with the right partners</span>
                  </span>
                  <Target className="h-5 w-5 shrink-0 text-[#ff6268] transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </a>
              </motion.div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <div className="bg-[#eef2f4]">
        <section id="features" aria-labelledby="features-heading" className="bg-transparent py-16 sm:py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 grid gap-4 sm:mb-12 sm:grid-cols-[minmax(0,1.2fr)_minmax(17rem,0.8fr)] sm:items-end sm:gap-10">
              <div>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0f766e]">
                  Network advantages
                </p>
                <h2 id="features-heading" className="font-[Montserrat] text-2xl font-extrabold leading-tight tracking-[-0.03em] text-[#123f3f] sm:text-3xl md:text-4xl">
                  Built to move your business forward
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-[#52616b] sm:justify-self-end sm:text-base sm:leading-7">
                Exclusive campaigns, adaptable technology, and responsive support—all designed to help you scale.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4 lg:gap-6">
              {[
                {
                  icon: (
                    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-7 w-7">
                      <path d="M24 5.5 29.6 17l12.7 1.8-9.2 9 2.2 12.7L24 34.5l-11.3 6 2.2-12.7-9.2-9L18.4 17 24 5.5Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
                      <path d="m24 5.5 5.6 11.4 12.7 1.9-9.2 9 2.2 12.7L24 34.5V5.5Z" fill="#5ff442" fillOpacity=".6" />
                    </svg>
                  ),
                  title: "Exclusive campaigns",
                  body: "Find quality campaigns, including exclusive offers that fit your audience.",
                },
                {
                  icon: (
                    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-7 w-7">
                      <rect x="6" y="7" width="36" height="34" rx="5" stroke="currentColor" strokeWidth="2.5" />
                      <path d="M6 16h36" stroke="currentColor" strokeWidth="2.5" />
                      <circle cx="12" cy="11.5" r="1" fill="#5ff442" />
                      <path d="m13 32 7-7 5 4 10-9" stroke="#5ff442" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M31 20h4v4" stroke="#5ff442" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                  title: "In-house platform",
                  body: "A flexible in-house platform delivers an intuitive experience for your day-to-day work.",
                },
                {
                  icon: (
                    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-7 w-7">
                      <path d="M8 39V27h8v12M20 39V19h8v20M32 39V9h8v30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="m8 20 11-8 8 3 13-9" stroke="#5ff442" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M34 6h6v6" stroke="#5ff442" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                  title: "Top verticals",
                  body: "Explore campaigns across popular verticals, with new opportunities added regularly.",
                },
                {
                  icon: (
                    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-7 w-7">
                      <rect x="5.5" y="11" width="37" height="27" rx="4" stroke="currentColor" strokeWidth="2.5" />
                      <path d="M6 19h36" stroke="currentColor" strokeWidth="2.5" />
                      <path d="M12 29h10" stroke="#5ff442" strokeWidth="2.5" strokeLinecap="round" />
                      <circle cx="34" cy="29" r="3" fill="#5ff442" stroke="#fff" strokeWidth="2" />
                    </svg>
                  ),
                  title: "Quick payments",
                  body: "Choose from multiple payment methods and, if eligible, qualify for faster payment terms.",
                },
              ].map((feature, i) => (
                <motion.div
                  key={feature.title}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-40px" }}
                  variants={fadeUp}
                  className="relative flex h-full gap-4 overflow-hidden rounded-2xl border border-[#d1e0dd] bg-white p-5 shadow-[0_8px_28px_rgba(15,76,80,0.06)] transition-all duration-300 hover:border-[#9fc4bd] hover:shadow-[0_16px_34px_rgba(15,76,80,0.12)] sm:block sm:p-6 sm:text-center"
                >
                  <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#f2faf8] to-transparent" />
                  <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0f766e] to-[#115e59] text-white shadow-[0_8px_18px_rgba(15,118,110,0.22)] sm:mx-auto sm:mb-5 sm:h-16 sm:w-16">
                    {feature.icon}
                  </div>
                  <div className="relative z-10 min-w-0">
                    <h3 className="mb-2 font-[Montserrat] text-lg font-extrabold tracking-tight text-[#123f3f] sm:mb-3 sm:text-xl">
                      {feature.title}
                    </h3>
                    <div aria-hidden="true" className="mb-3 h-0.5 w-8 rounded-full bg-[#10b981] sm:mx-auto" />
                    <p className="text-sm leading-6 text-[#52616b] sm:text-[15px] sm:leading-7">{feature.body}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="about" aria-labelledby="about-heading" className="overflow-hidden bg-transparent">
          <div className="relative mx-auto min-h-[350px] max-w-[1425px] px-0 py-12 md:min-h-[500px] md:py-0">
            <svg
              aria-hidden="true"
              viewBox="0 0 1425 440"
              fill="none"
              preserveAspectRatio="xMidYMid meet"
              className="pointer-events-none absolute left-0 top-1/2 hidden h-[430px] w-full -translate-y-1/2 md:block"
            >
              <defs>
                <filter id="about-cube-shadow" x="-30%" y="-30%" width="160%" height="180%">
                  <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#52616b" floodOpacity=".16" />
                </filter>
              </defs>
              {[
                { x: 247, y: 310 },
                { x: 629, y: 89 },
                { x: 996, y: 97 },
                { x: 506, y: 160 },
                { x: 873, y: 232 },
                { x: 506, y: 318 },
                { x: 752, y: 19 },
                { x: 356, y: 74 },
                { x: 640, y: 239 },
                { x: 1008, y: 310 },
              ].map(({ x, y }) => (
                <g key={`${x}-${y}`} transform={`translate(${x} ${y + 12}) scale(1.23 1.35)`} filter="url(#about-cube-shadow)">
                  <g>
                    <path className="about-cube-top" d="M0 15 33 0 66 15 33 32 0 15Z" fill="#e1e3e5" />
                    <path className="about-cube-left" d="M0 15 33 32v18L0 33V15Z" fill="#c7c9cb" />
                    <path className="about-cube-right" d="m66 15-33 17v18l33-17V15Z" fill="#d1d3d5" />
                    <path
                      className="about-cube-bands"
                      d="M0 37 33 54M66 37 33 54M0 44 33 61M66 44 33 61"
                      fill="none"
                      stroke="#e1f4ff"
                      strokeWidth="1.5"
                    />
                  </g>
                </g>
              ))}
              <g className="about-brand-base" transform="translate(370 213)" filter="url(#about-cube-shadow)">
                <g transform="scale(1.23 1.47)">
                  <path d="M0 49 33 62v12L0 61V49Z" fill="#74bce4" />
                  <path d="m66 49-33 13v12l33-13V49Z" fill="#5ba9d8" />
                </g>
              </g>
              <g className="about-brand-lift">
                <g transform="translate(370 213)" filter="url(#about-cube-shadow)">
                  <g transform="scale(1.23 1.47)">
                    <path d="M0 13 33 0l33 13-33 13L0 13Z" fill="#ef4548" />
                    <path d="M0 13 33 26v36L0 49V13Z" fill="#bd252c" />
                    <path d="m66 13-33 13v36l33-13V13Z" fill="#df343a" />
                    <g transform="rotate(23 16.5 41.5)">
                      <text x="15.3" y="39" fill="#fff" fontFamily="Arial Black, Arial, sans-serif" fontSize="7" fontStyle="italic" fontWeight="900" textAnchor="middle">
                        CRACK
                      </text>
                      <text x="15.6" y="50" fill="#fff" fontFamily="Arial Black, Arial, sans-serif" fontSize="5" fontStyle="italic" fontWeight="900" textAnchor="middle">
                        BOUNTY
                      </text>
                    </g>
                  </g>
                </g>
              </g>
            </svg>

            <div className="relative z-10 mx-4 rounded-[5px] border border-[#d7dce0] bg-white p-3 shadow-[0_2px_8px_rgba(25,35,45,0.06)] md:absolute md:right-[10%] md:top-1/2 md:mx-0 md:w-[min(522.5px,40%)] md:-translate-y-1/2">
              <h2 id="about-heading" className="mb-5 !font-[Arial,sans-serif] text-[16px] font-bold leading-5 text-[#17191b]">
                <span className="relative inline-block">
                  Powering Your Growth
                  <span aria-hidden="true" className="absolute -bottom-0.5 left-0 h-[3px] w-full bg-[#e23b3f]" />
                </span>{" "}
                with Smarter Marketing Solutions
              </h2>
              <p className="mb-[13px] font-[Arial,sans-serif] text-[16px] leading-6 text-[#212529]">
                Access a global network of marketing channels to increase sales, leads, sign-ups, app installs, or any other action you deem essential to evolving your brand. We give you control by ensuring you only pay for the action that you defined.
              </p>
            </div>
          </div>
        </section>
        </div>

        {/* PUBLISHERS */}
        <section id="publishers" aria-labelledby="publishers-heading" className="bg-white py-16 sm:py-20 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-14">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="order-2 lg:order-1"
              >
                <h2 id="publishers-heading" className="font-[Montserrat] mb-3 text-2xl font-extrabold text-[#263238] sm:mb-4 sm:text-3xl md:text-4xl">
                  Publishers
                </h2>
                <div className="mb-5 h-[3px] w-8 rounded-sm bg-[#5ff442]" />
                <p className="mb-4 text-[15px] leading-relaxed text-[#455964] sm:text-base md:text-[17px]">
                  Having a large experience with Publishers, we provide top-notch
                  technology and the ability to profit the most from your traffic.
                </p>
                <p className="mb-8 text-[15px] leading-relaxed text-[#455964] sm:text-base">
                  We help you find the right target for any type of traffic, providing
                  you tens of verticals and thousands of different campaigns. Our
                  experienced managers will solve any difficulty you might encounter
                  while promoting as well as suggesting you top performing verticals
                  and promotion channels.
                </p>
                <Link
                  href="/signup"
                  prefetch={false}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#263238] px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#1a2429]"
                >
                  Sign up
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="order-1 lg:order-2"
              >
                <PublisherIllustration />
              </motion.div>
            </div>
          </div>
        </section>

        {/* WHY BECOME A PUBLISHER */}
        <section id="services" aria-labelledby="services-heading" className="bg-gradient-to-b from-[#eef2f4] to-white py-16 sm:py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="mb-12 text-center sm:mb-14"
            >
              <h2 id="services-heading" className="font-[Montserrat] text-2xl font-extrabold text-[#263238] sm:text-3xl md:text-[32px]">
                Why become a Publisher?
              </h2>
              <div className="mx-auto mt-4 h-1 w-12 rounded-full bg-gradient-to-r from-[#5ff442] to-[#4dd935]" />
            </motion.div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: TrendingUp, title: "Competitive payouts", body: "We are always looking and adjust the payouts to be over the rest of the industry." },
                { icon: Target, title: "Private programs", body: "Besides the mainstream campaigns and programs, we offer you private affiliate programs." },
                { icon: LineChart, title: "Accurate reports", body: "Our platform is analyzing your traffic and provides comprehensive performance reports." },
                { icon: ArrowRight, title: "Smart redirect", body: "Never miss a conversion! Not eligible visitors are sent to the most profitable alternative." },
                { icon: Layers, title: "Developer tools", body: "We are able to provide adaptable real-time tools such as OfferWall, API Feed, S2S Postback, etc." },
                { icon: Headphones, title: "First-rate support", body: "Our team is working 24/7 to answer and fix any issues for you in no time." },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-40px" }}
                  variants={fadeUp}
                  className="group rounded-xl border border-[#e6ebed]/60 bg-white p-6 hover:border-[#5ff442]/40 hover:shadow-lg hover:shadow-[#5ff442]/10 transition-all duration-300"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#5ff442]/20 to-[#5ff442]/10 text-[#0e7a4d] group-hover:from-[#5ff442]/30 group-hover:to-[#5ff442]/15 transition-colors">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="font-[Montserrat] mb-2 text-base font-bold text-[#263238]">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-[#455964]">{item.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ADVERTISERS */}
        <section id="advertisers" aria-labelledby="advertisers-heading" className="bg-white py-16 sm:py-20 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-14">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <AdvertiserIllustration />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <h2 id="advertisers-heading" className="font-[Montserrat] mb-3 text-2xl font-extrabold text-[#263238] sm:mb-4 sm:text-3xl md:text-4xl">
                  Advertisers
                </h2>
                <div className="mb-5 h-[3px] w-8 rounded-sm bg-[#5ff442]" />
                <p className="mb-4 text-[15px] leading-relaxed text-[#455964] sm:text-base md:text-[17px]">
                  Always looking for perfection, we have a portfolio of only
                  top-performing campaigns from major verticals. Because of platform
                  flexibility and our large Publisher number, we are able to drive
                  traffic in no time and customize any new format.
                </p>
                <p className="mb-8 text-[15px] leading-relaxed text-[#455964] sm:text-base">
                  We are open to new affiliate programs and campaigns, if you are
                  interested please get in touch with us and we will find the best
                  solution for your needs.
                </p>
                <a
                  href="#contact"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#263238] px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#1a2429]"
                >
                  Contact us
                  <ArrowRight className="h-4 w-4" />
                </a>
              </motion.div>
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section id="contact" aria-labelledby="contact-heading" className="border-t border-[#263238]/8 bg-gradient-to-b from-[#f8fafb] to-[#ffffff] py-16 sm:py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-14">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="md:col-span-4"
              >
                <h2 id="contact-heading" className="font-[Montserrat] mb-3 text-2xl font-extrabold text-[#263238] sm:text-3xl md:text-[28px]">
                  Get In Touch<br />With Us
                </h2>
                <div className="mb-6 h-1 w-12 rounded-full bg-gradient-to-r from-[#5ff442] to-[#4dd935]" />
                <p className="mb-8 text-sm leading-relaxed text-[#455964]">
                  Feel free to contact us regarding any concerns and our team will
                  answer in a short time. We strive to provide the best support in
                  the industry.
                </p>

                <div className="space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#5ff442]/20 to-[#5ff442]/10 text-[#0e7a4d]">
                      <MapPin className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#6b7c87] mb-1">Address</p>
                      <p className="text-sm text-[#455964] leading-relaxed">16192 Coastal Highway<br />Lewes, DE 19958</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#5ff442]/20 to-[#5ff442]/10 text-[#0e7a4d]">
                      <Mail className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#6b7c87] mb-1">Email</p>
                      <a href="mailto:contact@crackbounty.afficix.com" className="text-sm font-medium text-[#0e7a4d] hover:text-[#359f25] transition-colors">
                        contact@crackbounty.afficix.com
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="md:col-span-8"
              >
                {status === "success" && (
                  <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#5ff442]/30 bg-gradient-to-r from-[#5ff442]/10 to-[#5ff442]/5 p-4 text-sm text-[#0e7a4d]">
                    <Check className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="font-medium">Thank you! Your message has been received and our team will reply shortly.</span>
                  </div>
                )}
                {submitError && (
                  <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-red-300 bg-gradient-to-r from-red-50 to-red-50/50 p-4 text-sm text-red-700">
                    <span className="font-medium">{submitError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
                    <FormField label="First Name" id="firstName" value={form.firstName} onChange={update("firstName")} error={errors.firstName} autoComplete="given-name" />
                    <FormField label="Last Name" id="lastName" value={form.lastName} onChange={update("lastName")} error={errors.lastName} autoComplete="family-name" />
                  </div>

                  <FormField label="E-mail" id="email" type="email" value={form.email} onChange={update("email")} error={errors.email} autoComplete="email" />

                  <div className="mb-6">
                    <label htmlFor="message" className="mb-2 block text-sm font-semibold text-[#263238]">
                      Message <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={4}
                      value={form.message}
                      onChange={update("message")}
                      placeholder="How can we help you?"
                      className={`w-full resize-none rounded-lg border bg-white px-4 py-3 text-sm text-[#263238] placeholder:text-[#9aa7b1] transition-all focus:outline-none focus:ring-2 ${
                        errors.message
                          ? "border-red-400 focus:ring-red-200"
                          : "border-[#d8e1e6] focus:border-[#cbd5e1] focus:ring-[#94a3b8]/15"
                      }`}
                    />
                    {errors.message && <p className="mt-1.5 text-xs text-red-500">{errors.message}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#5ff442] px-6 py-3 text-sm font-bold text-[#263238] shadow-lg shadow-[#5ff442]/20 transition-all hover:-translate-y-0.5 hover:bg-[#4dd935] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {status === "sending" ? "Sending…" : "Submit"}
                  </button>
                </form>
              </motion.div>
            </div>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}

function FormField({
  label, id, type = "text", value, onChange, error, autoComplete,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  autoComplete?: string;
}) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-[#263238]">
        {label} <span className="text-red-500">*</span>
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className={`min-h-11 w-full rounded-lg border bg-white px-4 py-3 text-sm text-[#263238] transition-colors focus:outline-none focus:ring-2 ${
          error
            ? "border-red-400 focus:ring-red-200"
            : "border-[#d8e1e6] focus:border-[#cbd5e1] focus:ring-[#94a3b8]/15"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function PublisherIllustration() {
  return (
    <div className="relative mx-auto aspect-[16/10] w-full max-w-[520px] overflow-hidden rounded-xl border border-[#e6ebed] bg-[#eef2f4]">
      <Image
        src="/favicon.png"
        alt="Crack Bounty brand icon"
        fill
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="object-contain p-10"
      />
    </div>
  );
}

function AdvertiserIllustration() {
  return (
    <div className="group relative mx-auto aspect-[16/10] w-full max-w-[520px] overflow-hidden rounded-xl border border-[#dce4e8] bg-[#10243b] shadow-[0_18px_42px_rgba(16,36,59,0.16)]">
      <Image
        src="/favicon.png"
        alt="Crack Bounty brand icon"
        fill
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="object-contain p-10"
      />
    </div>
  );
}