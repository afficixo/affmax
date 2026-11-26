"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion, type Variants } from "framer-motion";
import Image from "next/image";
import { Menu, X } from "lucide-react";

const navLinks = [
  { href: "/#home", label: "Home" },
  { href: "/#features", label: "About Us" },
  { href: "/#publishers", label: "Publishers" },
  { href: "/#advertisers", label: "Advertisers" },
  { href: "/#contact", label: "Contact" },
];

const mobileMenuVariants: Variants = {
  hidden: { opacity: 0, y: -8, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.22,
      ease: [0.22, 1, 0.36, 1],
      delayChildren: 0.025,
      staggerChildren: 0.025,
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.99,
    transition: {
      duration: 0.14,
      ease: [0.4, 0, 1, 1],
      staggerChildren: 0.012,
      staggerDirection: -1,
    },
  },
};

const mobileMenuItemVariants: Variants = {
  hidden: { opacity: 0, y: -4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] },
  },
  exit: { opacity: 0, y: -2, transition: { duration: 0.08 } },
};

export default function PublicLayout({
  children,
  className = "",
  footerVariant = "default",
  headerVariant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  footerVariant?: "default" | "auth" | "none";
  headerVariant?: "default" | "none";
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isHomePage = pathname === "/";
  const [active, setActive] = useState<string | null>(isHomePage ? "/#home" : null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (!isHomePage) {
      setIsScrolled(true);
      return;
    }

    const updateScrolledState = () => setIsScrolled(window.scrollY > 20);
    updateScrolledState();
    window.addEventListener("scroll", updateScrolledState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolledState);
  }, [isHomePage]);

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  useEffect(() => {
    if (!isHomePage) {
      setActive(null);
      return;
    }

    setActive("/#home");
    const sections = navLinks
      .map((link) => document.getElementById(link.href.split("#")[1]))
      .filter((el): el is HTMLElement => !!el);
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (top) setActive(`/#${top.target.id}`);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [isHomePage]);

  const go = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const hash = new URL(href, window.location.origin).hash;
    if (!hash) return;
    e.preventDefault();
    const el = document.querySelector(hash);
    if (!el) return;
    const headerHeight = document.querySelector("header")?.getBoundingClientRect().height ?? 72;
    const y = (el as HTMLElement).getBoundingClientRect().top + window.scrollY - headerHeight;
    window.scrollTo({ top: y, behavior: "smooth" });
    history.replaceState(null, "", hash);
    setOpen(false);
  };

  return (
    <div
      data-mobile-menu-open={open ? "true" : undefined}
      className={`public-site relative min-h-screen w-full overflow-x-hidden ${className}`}
    >
      <div className="relative z-10 flex min-h-screen flex-col">
        <header
          className={`${headerVariant === "none" ? "hidden " : ""}fixed inset-x-0 top-0 z-40 border-b border-[#ffffff1f] bg-[#10243b] ${
            isHomePage
              ? `transition-shadow duration-300 ${
                  isScrolled
                    ? "shadow-[0_6px_18px_rgba(0,0,0,0.2)]"
                    : "shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
                }`
              : "shadow-[0_6px_18px_rgba(0,0,0,0.2)]"
          } ${
            isHomePage
              ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#10243b]"
              : ""
          }`}
        >
          <nav
            aria-label="Main navigation"
            className={`relative z-10 mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-3 px-4 sm:px-6 ${
              isHomePage
                ? `text-white transition-[height] duration-300 ease-out lg:px-8 ${
                      isScrolled ? "lg:h-[68px]" : "lg:h-[78px]"
                  }`
                  : "text-white lg:h-[70px] lg:px-8"
            }`}
          >
            <a
              href={isHomePage ? "#home" : "/#home"}
              onClick={isHomePage ? (e) => go(e, "#home") : undefined}
              className="flex shrink-0 items-center"
            >
              <Image
                src="/logo.png"
                alt="Crack Bounty"
                width={2172}
                height={724}
                sizes="(min-width: 640px) 186px, 160px"
                className={`object-contain transition-[width,height] duration-300 ${
                  isHomePage && isScrolled
                    ? "h-12 w-[150px] sm:w-[170px]"
                    : "h-12 w-[160px] sm:h-14 sm:w-[186px]"
                }`}
                preload
              />
            </a>

            <div className={`relative flex items-center gap-3 ${isHomePage ? "ml-auto lg:gap-6" : "ml-auto"}`}>
              <div className="hidden items-center gap-1 lg:flex xl:gap-2">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={isHomePage ? (e) => go(e, link.href) : undefined}
                    aria-current={active === link.href ? "location" : undefined}
                    className={`${
                      isHomePage
                        ? "group relative rounded-md px-3 py-2.5 text-[13px] font-medium tracking-[0.01em] text-white/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#10243b]"
                        : "group relative rounded-md px-3 py-2.5 text-[13px] font-medium tracking-[0.01em] text-white/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#10243b]"
                    }`}
                  >
                    {link.label}
                    {isHomePage && (
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-x-3 bottom-1 h-0.5 rounded-full transition-opacity ${
                          active === link.href
                            ? "bg-[#ef4444] opacity-100"
                            : "bg-[#ffffff] opacity-0 group-hover:opacity-60"
                        }`}
                      />
                    )}
                  </a>
                ))}
              </div>

              <div
                className={`relative flex items-center gap-2 ${
                  isHomePage ? "lg:ml-1 lg:border-l lg:border-[#ffffff33] lg:pl-4" : ""
                }`}
              >
                <Link
                  href="/signup"
                  prefetch={false}
                  className="hidden items-center rounded-md border border-[rgba(226,59,63,0.7)] bg-[linear-gradient(135deg,#ef4548_0%,#bd252c_100%)] px-4 py-2.5 text-[13px] font-semibold text-[#ffffff] shadow-[0_8px_22px_rgba(226,59,63,0.24)] transition-[background,box-shadow,transform,color,border-color] duration-150 ease-in-out hover:-translate-y-px hover:border-[#ef4548] hover:bg-[linear-gradient(135deg,#10243b_0%,#183450_100%)] hover:text-[#ef4548] hover:shadow-[0_10px_26px_rgba(16,36,59,0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#10243b] lg:inline-flex"
                >
                  Sign up
                </Link>
                <Link
                  href="/login"
                  prefetch={false}
                  aria-current={pathname === "/login" ? "page" : undefined}
                  className="hidden items-center rounded-md px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#10243b] lg:inline-flex"
                >
                  Login
                </Link>
                <MotionConfig reducedMotion="user">
                  <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className={`group grid h-10 w-10 place-items-center rounded-full transition-[background-color,color,transform] duration-200 active:scale-95 lg:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8aff70] focus-visible:ring-offset-2 focus-visible:ring-offset-[#10243b] ${
                      open
                        ? "bg-[rgba(95,244,66,0.12)] text-[#8aff70]"
                        : "bg-transparent text-[#d3dce6] hover:bg-[rgba(95,244,66,0.1)]"
                    }`}
                    aria-label="Toggle navigation"
                    aria-expanded={open}
                    aria-controls="public-mobile-menu"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={open ? "close" : "menu"}
                        initial={{ opacity: 0, scale: 0.75, rotate: -45 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.75, rotate: 45 }}
                        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                        className="grid place-items-center"
                      >
                        {open ? (
                          <X
                            className="h-[22px] w-[22px] text-[#8aff70]"
                            strokeWidth={2.25}
                          />
                        ) : (
                          <Menu
                            className="h-[22px] w-[22px] text-[#d3dce6] group-hover:text-[#8aff70]"
                            strokeWidth={2.25}
                          />
                        )}
                      </motion.span>
                    </AnimatePresence>
                  </button>

                  <AnimatePresence>
                    {headerVariant !== "none" && open && (
                      <motion.div
                        id="public-mobile-menu"
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        variants={mobileMenuVariants}
                        className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(18rem,calc(100vw-2rem))] origin-top-right lg:hidden"
                      >
                      <nav
                        aria-label="Mobile navigation"
                        className="rounded-xl border border-[#5ff44233] bg-[rgba(16,36,59,0.97)] p-2.5 text-[#d3dce6] shadow-[0_22px_55px_rgba(0,0,0,0.48)] backdrop-blur-xl"
                      >
                        <ul className="m-0 list-none space-y-0.5 p-0">
                          {navLinks.map((link) => (
                            <motion.li key={link.href} variants={mobileMenuItemVariants}>
                              <a
                                href={link.href}
                                onClick={(event) => {
                                  if (isHomePage) go(event, link.href);
                                  else setOpen(false);
                                }}
                                aria-current={isHomePage && active === link.href ? "location" : undefined}
                                className={`transition-colors ${
                                  isHomePage && active === link.href
                                    ? "block rounded-lg bg-[rgba(95,244,66,0.12)] px-3 py-2.5 text-sm font-semibold text-[#8aff70]"
                                    : "block rounded-lg px-3 py-2.5 text-sm font-medium text-[#d3dce6] hover:bg-[rgba(95,244,66,0.07)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8aff70]"
                                }`}
                              >
                                {link.label}
                              </a>
                            </motion.li>
                          ))}
                          {!isHomePage && (
                            <motion.li className="pt-1" variants={mobileMenuItemVariants}>
                              <Link
                                href="/signup"
                                prefetch={false}
                                onClick={() => setOpen(false)}
                                className="block rounded-md bg-[#e23b3f] px-3 py-2.5 text-center text-sm font-semibold text-[#ffffff] transition-colors hover:bg-[#bd252c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef4548]"
                              >
                                Sign up
                              </Link>
                            </motion.li>
                          )}
                          <motion.li className="pt-1" variants={mobileMenuItemVariants}>
                            <Link
                              href="/login"
                              prefetch={false}
                              onClick={() => setOpen(false)}
                              aria-current={pathname === "/login" ? "page" : undefined}
                              className="block rounded-lg border border-[#5ff4424d] px-3 py-2.5 text-center text-sm font-semibold text-[#d3dce6] transition-colors hover:border-[#5ff442] hover:bg-[rgba(95,244,66,0.08)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8aff70]"
                            >
                              Login
                            </Link>
                          </motion.li>
                        </ul>
                      </nav>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </MotionConfig>
              </div>
            </div>
          </nav>
        </header>

        {open && (
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default bg-transparent lg:hidden"
          />
        )}

        {children}

        {footerVariant === "none" ? null : footerVariant === "auth" ? (
          <footer className="mt-auto bg-[#e9ecef]">
            <div className="mx-auto max-w-7xl px-4 py-5 text-center sm:px-6 lg:px-8">
              <p className="text-[13px] leading-relaxed text-[#6c757d]">
                © 2019 - 2026 Crack Bounty LLC - All rights reserved
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#6c757d]">
                <Link href="/privacy" className="hover:text-[#495057] hover:underline">
                  Privacy Policy
                </Link>
                <span className="mx-2" aria-hidden="true">
                  {" "}
                </span>
                <Link href="/terms" className="hover:text-[#495057] hover:underline">
                  Terms &amp; Conditions
                </Link>
              </p>
            </div>
          </footer>
        ) : (
          <footer className="mt-auto border-t border-[#ffffff1a] bg-[#0b1524] text-[#c2ccda]">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 sm:flex-row sm:px-6 lg:px-8">
              <Link
                href="/#home"
                className="inline-flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8aff70]"
              >
                <Image
                  src="/logo.png"
                  alt="Crack Bounty"
                  width={2172}
                  height={724}
                  sizes="120px"
                  className="h-8 w-[120px] object-contain object-left"
                />
              </Link>
              <p className="text-center text-xs text-[#8390a3] sm:text-right">
                © 2019–2026 Crack Bounty. All rights reserved.
              </p>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
