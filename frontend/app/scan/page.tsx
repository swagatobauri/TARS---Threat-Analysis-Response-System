"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Terminal, ShieldAlert, Fingerprint, Lock, Globe } from "lucide-react";

export default function SelfScanPage() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const runScan = async () => {
      try {
        // Step 1: Initializing
        await new Promise((r) => setTimeout(r, 1500));
        setStep(1);

        // Fetch IP and Geo data with fallback for ad-blockers
        let geoData = {};
        try {
          const res = await fetch("https://ipwho.is/"); // ipwho.is is less likely to be blocked
          if (!res.ok) throw new Error("Primary API failed");
          geoData = await res.json();
          // ipwho.is returns slightly different keys than ipapi.co, normalize them:
          if ((geoData as any).ip) {
            geoData = {
              ip: (geoData as any).ip,
              org: (geoData as any).connection?.org || "Unknown ASN",
              city: (geoData as any).city,
              region: (geoData as any).region,
              country_name: (geoData as any).country,
              latitude: (geoData as any).latitude,
              longitude: (geoData as any).longitude,
            };
          }
        } catch (e) {
          // If all network requests are blocked by Brave/uBlock, gracefully degrade
          geoData = {
            ip: "HIDDEN (PROXY DETECTED)",
            org: "ENCRYPTED ROUTING",
            city: "Classified",
            region: "Classified",
            country_name: "Classified",
            latitude: "UNKNOWN",
            longitude: "UNKNOWN",
          };
        }

        // Gather browser fingerprinting info
        const browserData = {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          screen: `${window.screen.width}x${window.screen.height} (Color Depth: ${window.screen.colorDepth}-bit)`,
          cores: navigator.hardwareConcurrency || "Unknown",
          memory: (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB+` : "Unknown",
          connection: (navigator as any).connection ? (navigator as any).connection.effectiveType : "Unknown",
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };

        setData({ ...geoData, ...browserData });

        // Step 2: Extracted IP
        await new Promise((r) => setTimeout(r, 1500));
        setStep(2);

        // Step 3: Fingerprinting
        await new Promise((r) => setTimeout(r, 1500));
        setStep(3);

        // Step 4: Final Evaluation
        await new Promise((r) => setTimeout(r, 2000));
        setStep(4);

      } catch (err) {
        console.error(err);
        setError(true);
      }
    };

    runScan();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-black text-[#cc0000] flex flex-col items-center justify-center font-mono p-6 text-center">
        <ShieldAlert size={48} className="mb-4" />
        <h1 className="text-2xl font-bold tracking-widest mb-2">CONNECTION BLOCKED</h1>
        <p className="text-[#666]">Ad-blocker or privacy shield prevented the scan.</p>
        <p className="text-[#666] mt-1">Good. Keep your shields up.</p>
        <Link href="/" className="mt-8 border border-[#cc0000] px-6 py-2 hover:bg-[#cc0000] hover:text-black transition-colors">
          RETURN
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-[#00ff88] flex flex-col p-6 font-mono selection:bg-[#cc0000] selection:text-white relative overflow-hidden">
      
      {/* Scanline overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-20"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)",
        }}
      />

      {/* Header */}
      <header className="flex justify-between items-center pb-6 border-b border-[#1a1a1a] relative z-10">
        <Link href="/" className="flex items-center gap-2 text-[#666] hover:text-[#cc0000] transition-colors">
          <ArrowLeft size={16} />
          <span className="tracking-widest uppercase text-xs">Disconnect</span>
        </Link>
        <div className="flex items-center gap-2 text-[#cc0000]">
          <Terminal size={16} />
          <span className="tracking-[0.2em] font-bold">TARS_OS // DEEP SCAN</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto mt-12 relative z-10">
        
        {/* Loading State */}
        {step < 4 && (
          <div className="flex flex-col items-center justify-center pt-24">
            <div className="text-4xl mb-8 animate-pulse text-[#cc0000]">
              {step === 0 && "INITIALIZING NEURAL LINK..."}
              {step === 1 && "BYPASSING PROXIES..."}
              {step === 2 && "EXTRACTING FINGERPRINT..."}
              {step === 3 && "ANALYZING VULNERABILITIES..."}
            </div>
            <div className="w-64 h-1 bg-[#1a1a1a] overflow-hidden relative">
              <div 
                className="absolute top-0 left-0 h-full bg-[#cc0000] transition-all duration-[1500ms] ease-out" 
                style={{ width: `${(step / 3) * 100}%` }} 
              />
            </div>
          </div>
        )}

        {/* Results */}
        {step === 4 && data && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            
            {/* The Message */}
            <div className="text-center space-y-6">
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-[#cc0000] glitch-text">
                WE SEE YOU.
              </h1>
              <div className="border-y border-[#cc0000] py-4 bg-[#110000]">
                <p className="text-xl md:text-2xl font-light tracking-widest text-[#fff]">
                  IF YOU CAN SEE THIS, <span className="font-bold text-[#cc0000]">THEY CAN ALSO SEE THIS.</span>
                </p>
              </div>
            </div>

            {/* Data Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Network Identity */}
              <div className="border border-[#333] bg-[#050505] p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#cc0000]" />
                <h3 className="text-xs tracking-[0.2em] text-[#666] uppercase mb-6 flex items-center gap-2">
                  <Globe size={14} className="text-[#cc0000]" /> Network Identity
                </h3>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between border-b border-[#111] pb-2">
                    <span className="text-[#555]">PUBLIC IP</span>
                    <span className="text-white font-bold tracking-wider">{data.ip}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#111] pb-2">
                    <span className="text-[#555]">ISP / ASN</span>
                    <span className="text-[#aaa]">{data.org}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#111] pb-2">
                    <span className="text-[#555]">LOCATION</span>
                    <span className="text-[#aaa]">{data.city}, {data.region}, {data.country_name}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#111] pb-2">
                    <span className="text-[#555]">COORDINATES</span>
                    <span className="text-[#aaa]">{data.latitude}, {data.longitude}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#111] pb-2">
                    <span className="text-[#555]">TIMEZONE</span>
                    <span className="text-[#aaa]">{data.timeZone}</span>
                  </div>
                </div>
              </div>

              {/* Device Fingerprint */}
              <div className="border border-[#333] bg-[#050505] p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#cc0000]" />
                <h3 className="text-xs tracking-[0.2em] text-[#666] uppercase mb-6 flex items-center gap-2">
                  <Fingerprint size={14} className="text-[#cc0000]" /> Hardware Fingerprint
                </h3>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between border-b border-[#111] pb-2">
                    <span className="text-[#555]">OS / PLATFORM</span>
                    <span className="text-[#aaa]">{data.platform}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#111] pb-2">
                    <span className="text-[#555]">CPU CORES</span>
                    <span className="text-[#aaa]">{data.cores}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#111] pb-2">
                    <span className="text-[#555]">RAM ESTIMATE</span>
                    <span className="text-[#aaa]">{data.memory}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#111] pb-2">
                    <span className="text-[#555]">RESOLUTION</span>
                    <span className="text-[#aaa]">{data.screen}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#111] pb-2">
                    <span className="text-[#555]">CONNECTION</span>
                    <span className="text-[#aaa]">{data.connection.toUpperCase()}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Raw User Agent string */}
            <div className="border border-[#1a1a1a] bg-black p-4 text-[10px] text-[#444] break-all">
              <span className="text-[#cc0000]">RAW_AGENT_STRING:</span> {data.userAgent}
            </div>

            {/* Verdict */}
            <div className="mt-12 border-2 border-[#00ff88] p-6 flex flex-col md:flex-row items-center justify-between gap-6 bg-[#001100]">
              <div className="flex items-center gap-4">
                <Lock size={32} className="text-[#00ff88]" />
                <div>
                  <h2 className="text-xl font-bold tracking-widest text-[#00ff88]">TARS VERDICT: SAFE</h2>
                  <p className="text-sm text-[#00aa55]">You are currently flying under the radar.</p>
                </div>
              </div>
              <Link 
                href="/dashboard" 
                className="bg-[#00ff88] text-black px-6 py-3 font-bold tracking-widest uppercase hover:bg-white transition-colors whitespace-nowrap"
              >
                ACCESS MISSION CONTROL
              </Link>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
