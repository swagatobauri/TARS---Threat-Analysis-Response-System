"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const [glitchText, setGlitchText] = useState("TARS");
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [showContent, setShowContent] = useState(false);

  const bootSequence = [
    "> initializing kernel...",
    "> loading threat models [████████████] 100%",
    "> connecting neural mesh...",
    "> anomaly detection: ARMED",
    "> reasoning engine: ONLINE",
    "> groq llm bridge: CONNECTED",
    "> memory store: 2.4TB indexed",
    "> system status: LETHAL",
    "",
    "> TARS is watching.",
  ];

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < bootSequence.length) {
        setTerminalLines((prev) => [...prev, bootSequence[i]]);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => setShowContent(true), 300);
      }
    }, 150);
    return () => clearInterval(interval);
  }, []);

  // Glitch effect
  useEffect(() => {
    const chars = "TARS_OS#@!$%&";
    const interval = setInterval(() => {
      if (Math.random() > 0.92) {
        const glitched = "TARS"
          .split("")
          .map((c) =>
            Math.random() > 0.5
              ? chars[Math.floor(Math.random() * chars.length)]
              : c
          )
          .join("");
        setGlitchText(glitched);
        setTimeout(() => setGlitchText("TARS"), 100);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden selection:bg-red-600 selection:text-white">
      {/* Scanline overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)",
        }}
      />

      {/* Blood red accent line at top */}
      <div className="w-full h-[2px] bg-[#cc0000] fixed top-0 z-40" />

      {/* Nav */}
      <nav className="flex justify-between items-center px-8 py-6 relative z-30">
        <span className="font-mono text-sm tracking-[0.3em] text-[#cc0000]">
          TARS_OS v3.1
        </span>
        <div className="flex gap-8 items-center">
          <Link
            href="/dashboard"
            className="font-mono text-xs tracking-widest text-[#666] hover:text-[#cc0000] transition-colors uppercase"
          >
            Mission Control
          </Link>
          <Link
            href="/war-games"
            className="font-mono text-xs tracking-widest bg-[#cc0000] text-black px-4 py-2 hover:bg-[#ff0000] transition-colors uppercase font-bold"
          >
            War Games
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 relative z-10">
        {/* Giant Title */}
        <div className="text-center mb-12">
          <h1
            className="font-mono font-black tracking-tighter leading-none"
            style={{ fontSize: "clamp(80px, 15vw, 200px)", color: "#cc0000" }}
          >
            {glitchText}
          </h1>
          <div className="h-[1px] w-48 bg-[#cc0000] mx-auto my-6 opacity-60" />
          <p
            className="font-mono text-sm tracking-[0.5em] uppercase text-[#888]"
            style={{
              opacity: showContent ? 1 : 0,
              transition: "opacity 0.8s",
            }}
          >
            Threat Analysis & Response System
          </p>
        </div>

        {/* Brutalist tagline */}
        <div
          className="text-center max-w-3xl mb-16"
          style={{
            opacity: showContent ? 1 : 0,
            transition: "opacity 1s 0.3s",
          }}
        >
          <p className="font-mono text-2xl md:text-3xl font-light leading-relaxed text-white">
            An autonomous AI agent that{" "}
            <span className="text-[#cc0000] font-bold">watches</span>,{" "}
            <span className="text-[#cc0000] font-bold">learns</span>, and{" "}
            <span className="text-[#cc0000] font-bold">eliminates</span>{" "}
            threats before you even know they exist.
          </p>
          <p className="font-mono text-xs text-[#555] mt-6 tracking-widest uppercase">
            It doesn&apos;t sleep. It doesn&apos;t forget. It doesn&apos;t
            forgive.
          </p>
        </div>

        {/* CTA Buttons */}
        <div
          className="flex flex-wrap justify-center gap-4 max-w-3xl"
          style={{
            opacity: showContent ? 1 : 0,
            transition: "opacity 1s 0.6s",
          }}
        >
          <Link
            href="/scan"
            className="border-2 border-[#00ff88] text-[#00ff88] px-8 py-4 font-mono text-sm tracking-widest uppercase hover:bg-[#00ff88] hover:text-black transition-all"
          >
            Scan My Connection
          </Link>
          <Link
            href="/dashboard"
            className="border-2 border-[#cc0000] text-[#cc0000] px-8 py-4 font-mono text-sm tracking-widest uppercase hover:bg-[#cc0000] hover:text-black transition-all"
          >
            Mission Control
          </Link>
          <Link
            href="/war-games"
            className="bg-[#cc0000] text-black px-8 py-4 font-mono text-sm tracking-widest uppercase font-bold hover:bg-[#ff0000] transition-all"
          >
            War Games
          </Link>
        </div>

        {/* Boot terminal */}
        <div
          className="mt-16 w-full max-w-xl border border-[#1a1a1a] bg-[#050505] p-4 font-mono text-[11px] text-[#00ff88] leading-relaxed"
          style={{
            opacity: showContent ? 0.7 : 1,
            transition: "opacity 1s",
          }}
        >
          {terminalLines.map((line, i) => (
            <div
              key={i}
              className={
                line && (line.includes("LETHAL") || line.includes("watching"))
                  ? "text-[#cc0000]"
                  : ""
              }
            >
              {line}
            </div>
          ))}
          <div className="animate-pulse">_</div>
        </div>
      </main>

      {/* Bottom bar */}
      <footer className="px-8 py-4 flex justify-between items-center font-mono text-[10px] text-[#444] tracking-widest relative z-30">
        <span>AUTONOMOUS INTRUSION RESPONSE SYSTEM</span>
        <span>
          OBSERVE → ANALYZE → REASON → DECIDE → ACT → LEARN
        </span>
      </footer>
    </div>
  );
}
