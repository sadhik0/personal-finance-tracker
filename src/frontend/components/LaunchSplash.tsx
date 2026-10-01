"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

// LAUNCH_SPLASH_V1
//
// Launch screen shown once per app launch, on top of everything else.
//   Part 1 (INTRO_MS):   logo with a spinning ring + one changing word per second. No percentage.
//   Part 2 (WELCOME_MS): welcome message + feature lines + a plain progress bar (no text).
// Then it fades out and the dashboard underneath (already showing your last saved numbers) is revealed.
//
// Why it is never blank: this component is in the server HTML and uses only CSS + inline SVG, so it
// paints on the first frame. Everything is part of the app's cached files, so it also works offline.
//
// Tune the timing here:
const INTRO_MS = 5000; // part 1 length. Each word shows for INTRO_MS / WORDS.length
const WELCOME_MS = 5000; // part 2 length (the bar fills over exactly this time)
const FADE_MS = 450; // fade-out at the end
const WORDS = ["Loading", "Syncing", "Analysing", "Securing", "Preparing"];

// Remembered for the browser session, so the splash plays once per app launch, not on every reload.
// Open any page with ?splash at the end of the address to replay it for testing.
const SEEN_KEY = "pft-splash-seen";

const FEATURES = [
  "50/30/20 benchmark, personal plan and actual behaviour",
  "Nine transaction types with correct accounting rules",
  "Income & expense, balance sheet and cash-flow statements",
  "Analytics, category drill-down and limit alerts",
  "Excel + PDF export, responsive on phone and laptop",
];

// Runs before the page is shown. If the splash was already played in this session it hides the
// splash immediately, so a reload never flashes it.
const HIDE_IF_SEEN = `try{var f=/[?&]splash(=|&|$)/.test(location.search);if(sessionStorage.getItem("${SEEN_KEY}")==="1"&&!f){var e=document.getElementById("ls-root");if(e)e.style.display="none"}}catch(_){}`;

const CSS = `
.ls-root{position:fixed;inset:0;z-index:200;background:#0B1220;color:#F8FAFC;overflow:hidden;opacity:1;transition:opacity ${FADE_MS}ms ease}
.ls-root.ls-leave{opacity:0;pointer-events:none}
.ls-layer{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:24px;padding-top:calc(24px + env(safe-area-inset-top,0px));padding-bottom:calc(24px + env(safe-area-inset-bottom,0px));
  opacity:0;transition:opacity .25s ease;pointer-events:none}
.ls-layer.ls-on{opacity:1}
.ls-skip{position:absolute;z-index:2;top:calc(env(safe-area-inset-top,0px) + 8px);right:8px;padding:12px 16px;
  font:inherit;font-size:13px;color:#94A3B8;background:none;border:0;border-radius:10px;cursor:pointer}
.ls-skip:hover{color:#F8FAFC}
.ls-skip:focus-visible{outline:2px solid #38BDF8;outline-offset:2px}

.ls-mark{position:relative;width:112px;height:112px;display:grid;place-items:center}
.ls-ring{position:absolute;inset:0;animation:ls-spin 1.4s linear infinite}
.ls-tile{width:64px;height:64px;border-radius:18px;display:grid;place-items:center;
  background:linear-gradient(135deg,#38BDF8,#8B5CF6);box-shadow:0 10px 36px rgba(56,189,248,.28)}
.ls-wordbox{margin-top:28px;height:28px;font-size:18px;font-weight:500;line-height:28px;letter-spacing:.01em}
.ls-word{display:block;animation:ls-word .35s ease both}

.ls-col{width:100%;max-width:420px}
.ls-brand{display:flex;align-items:center;gap:12px;margin-bottom:36px}
.ls-brand-tile{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;
  background:linear-gradient(135deg,#38BDF8,#8B5CF6)}
.ls-brand-name{margin:0;font-size:15px;font-weight:600;line-height:1.2}
.ls-brand-sub{margin:0;font-size:12px;color:#94A3B8}
.ls-h1{margin:0;font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-.02em}
.ls-lead{margin:16px 0 0;font-size:16px;line-height:1.5;color:#CBD5E1}
.ls-list{list-style:none;margin:24px 0 0;padding:0;display:grid;gap:10px}
.ls-list li{display:flex;gap:10px;font-size:14px;line-height:1.4;color:#94A3B8}
.ls-list li::before{content:"";flex:none;width:6px;height:6px;margin-top:7px;border-radius:50%;background:#38BDF8}
.ls-rise{opacity:0;animation:ls-in .5s ease forwards}
.ls-track{margin-top:40px;height:4px;border-radius:4px;background:#172033;overflow:hidden}
.ls-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,#38BDF8,#8B5CF6);
  transform-origin:left center;animation:ls-bar var(--ls-bar) linear forwards}

@keyframes ls-spin{to{transform:rotate(360deg)}}
@keyframes ls-word{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes ls-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes ls-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}

@media (min-width:640px){.ls-h1{font-size:34px}}
@media (prefers-reduced-motion:reduce){
  .ls-ring{animation:none}
  .ls-word{animation:none}
  .ls-rise{animation:none;opacity:1}
  .ls-root,.ls-layer{transition:none}
}
`;

function WalletIcon({ size }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

export default function LaunchSplash() {
  const [wordIndex, setWordIndex] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [gone, setGone] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
  }, []);

  // Fade out, remember that this session has seen the splash, then remove it from the page.
  const leave = useCallback(() => {
    stopAll();
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* storage blocked: the splash simply plays again next time */
    }
    setExiting(true);
    timers.current.push(setTimeout(() => setGone(true), FADE_MS));
  }, [stopAll]);

  useEffect(() => {
    let seen = false;
    let forced = false;
    try {
      forced = /[?&]splash(=|&|$)/.test(window.location.search);
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* storage blocked: play the splash */
    }

    if (seen && !forced) {
      timers.current.push(setTimeout(() => setGone(true), 0));
      return stopAll;
    }

    ticker.current = setInterval(
      () => setWordIndex((i) => Math.min(i + 1, WORDS.length - 1)),
      INTRO_MS / WORDS.length,
    );
    timers.current.push(
      setTimeout(() => {
        if (ticker.current) clearInterval(ticker.current);
        ticker.current = null;
        setShowWelcome(true);
      }, INTRO_MS),
    );
    timers.current.push(setTimeout(leave, INTRO_MS + WELCOME_MS));

    return stopAll;
  }, [leave, stopAll]);

  if (gone) return null;

  return (
    <>
      <style>{CSS}</style>
      <div
        id="ls-root"
        className={`ls-root${exiting ? " ls-leave" : ""}`}
        role="status"
        aria-label="Loading Finance Tracker"
        suppressHydrationWarning
      >
        <button type="button" className="ls-skip" onClick={leave}>
          Skip
        </button>

        {/* Part 1: spinning logo + changing word */}
        <div className={`ls-layer${showWelcome ? "" : " ls-on"}`} aria-hidden="true">
          <div className="ls-mark">
            <svg className="ls-ring" viewBox="0 0 112 112" fill="none">
              <defs>
                <linearGradient id="ls-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#38BDF8" />
                  <stop offset="1" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
              <circle cx="56" cy="56" r="52" stroke="#172033" strokeWidth="3" />
              <circle
                cx="56"
                cy="56"
                r="52"
                stroke="url(#ls-grad)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="110 217"
              />
            </svg>
            <div className="ls-tile">
              <WalletIcon size={30} />
            </div>
          </div>
          <div className="ls-wordbox">
            <span key={wordIndex} className="ls-word">
              {WORDS[wordIndex]}…
            </span>
          </div>
        </div>

        {/* Part 2: welcome message + features + plain progress bar */}
        {showWelcome && (
          <div className="ls-layer ls-on">
            <div className="ls-col">
              <div className="ls-brand">
                <div className="ls-brand-tile">
                  <WalletIcon size={20} />
                </div>
                <div>
                  <p className="ls-brand-name">Finance Tracker</p>
                  <p className="ls-brand-sub">Personal financial intelligence</p>
                </div>
              </div>

              <h1 className="ls-h1 ls-rise">Welcome to your personal finance tracker.</h1>
              <p className="ls-lead ls-rise" style={{ animationDelay: "0.5s" }}>
                Track income, expenses, savings, investments, family support and debt — in one
                private dashboard.
              </p>
              <ul className="ls-list">
                {FEATURES.map((text, i) => (
                  <li key={text} className="ls-rise" style={{ animationDelay: `${0.9 + i * 0.35}s` }}>
                    {text}
                  </li>
                ))}
              </ul>

              <div className="ls-track" aria-hidden="true">
                <div className="ls-fill" style={{ "--ls-bar": `${WELCOME_MS}ms` } as CSSProperties} />
              </div>
            </div>
          </div>
        )}
      </div>
      <script dangerouslySetInnerHTML={{ __html: HIDE_IF_SEEN }} />
    </>
  );
}