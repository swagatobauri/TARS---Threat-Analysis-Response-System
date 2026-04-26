import React from "react";
import { TerminalSquare, ShieldCheck, Zap, Lock, Code, Copy, CheckCircle2 } from "lucide-react";

export default function SDKIntegrationPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="border-b border-[#222] pb-6">
        <div className="flex items-center gap-3 mb-2">
          <TerminalSquare className="text-[#cc0000] w-8 h-8" />
          <h1 className="text-3xl font-mono tracking-wider font-bold text-white uppercase">
            TARS SDK Integration
          </h1>
        </div>
        <p className="text-[#888] font-mono max-w-3xl leading-relaxed">
          Embed TARS directly into your enterprise web infrastructure. The SDK acts as a lightweight, non-blocking 
          middleware that streams real-time traffic metadata to your self-hosted Mission Control for autonomous threat analysis.
        </p>
      </header>

      {/* Why Use TARS SDK */}
      <section>
        <h2 className="text-xl font-mono text-white mb-4 uppercase tracking-widest flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#cc0000]" />
          Why Use The SDK?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#111] border border-[#222] p-5 rounded-lg hover:border-[#444] transition-colors">
            <Zap className="w-6 h-6 text-yellow-500 mb-3" />
            <h3 className="text-white font-mono font-bold mb-2">Zero Latency</h3>
            <p className="text-[#888] text-sm">
              Operates asynchronously in `monitoring` mode. It batches and flushes logs to the TARS backend 
              without blocking or slowing down your user requests.
            </p>
          </div>
          <div className="bg-[#111] border border-[#222] p-5 rounded-lg hover:border-[#444] transition-colors">
            <Lock className="w-6 h-6 text-blue-500 mb-3" />
            <h3 className="text-white font-mono font-bold mb-2">Total Data Privacy</h3>
            <p className="text-[#888] text-sm">
              Because TARS is self-hosted, your enterprise traffic logs never leave your private cloud. 
              No third-party SaaS vendors snooping on your data.
            </p>
          </div>
          <div className="bg-[#111] border border-[#222] p-5 rounded-lg hover:border-[#444] transition-colors">
            <ShieldCheck className="w-6 h-6 text-green-500 mb-3" />
            <h3 className="text-white font-mono font-bold mb-2">Instant AI Protection</h3>
            <p className="text-[#888] text-sm">
              Immediately connects your website to the TARS Autonomous Agent, giving you real-time anomaly 
              scoring, kill-chain tracking, and automated response.
            </p>
          </div>
        </div>
      </section>

      {/* Installation & Code */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Step 1 */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-mono text-white mb-4 uppercase tracking-widest flex items-center gap-2">
              <Code className="w-5 h-5 text-[#cc0000]" />
              1. Installation
            </h2>
            <div className="bg-[#0a0a0a] border border-[#333] p-4 rounded-lg relative group">
              <code className="text-green-400 font-mono text-sm">npm install tars-sdk-node</code>
              <button className="absolute top-3 right-3 text-[#555] hover:text-white transition-colors">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-mono text-white mb-4 uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#cc0000]" />
              2. Configuration
            </h2>
            <p className="text-[#888] text-sm mb-4 leading-relaxed font-mono">
              The SDK must be initialized with your self-hosted TARS Backend URL. 
              It acts as an Express.js middleware, meaning it should be placed *before* your application routes.
            </p>
            <ul className="space-y-2 text-sm text-[#777] font-mono list-disc pl-5">
              <li><strong className="text-[#aaa]">serverUrl:</strong> Your TARS FastAPI endpoint.</li>
              <li><strong className="text-[#aaa]">mode:</strong> Use 'monitoring' (async) or 'blocking' (inline).</li>
              <li><strong className="text-[#aaa]">batchSize:</strong> How many requests to group before flushing.</li>
            </ul>
          </div>
        </div>

        {/* Step 2 - Code snippet */}
        <div className="bg-[#0a0a0a] border border-[#333] rounded-lg overflow-hidden flex flex-col">
          <div className="bg-[#111] px-4 py-2 border-b border-[#333] flex justify-between items-center">
            <span className="text-[#888] font-mono text-xs">server.js (Express)</span>
            <button className="text-[#555] hover:text-white transition-colors">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 overflow-x-auto flex-1 text-sm font-mono text-[#ddd] leading-loose">
            <pre>
<span className="text-pink-400">const</span> express = <span className="text-blue-400">require</span>(<span className="text-green-300">'express'</span>);{`\n`}
<span className="text-pink-400">const</span> {`{ TarsMiddleware }`} = <span className="text-blue-400">require</span>(<span className="text-green-300">'tars-sdk-node'</span>);{`\n\n`}

<span className="text-pink-400">const</span> app = <span className="text-yellow-200">express</span>();{`\n\n`}

<span className="text-[#666]">{"// 1. Initialize the SDK with your self-hosted TARS URL"}</span>{`\n`}
<span className="text-pink-400">const</span> tars = <span className="text-pink-400">new</span> <span className="text-yellow-200">TarsMiddleware</span>({`{\n`}
  serverUrl: <span className="text-green-300">'http://localhost:8000'</span>,{`\n`}
  apiKey: <span className="text-green-300">'optional-api-key'</span>,{`\n`}
  mode: <span className="text-green-300">'monitoring'</span>, <span className="text-[#666]">{"// Async analysis"}</span>{`\n`}
  batchSize: <span className="text-purple-400">10</span>,{`\n`}
  flushInterval: <span className="text-purple-400">5000</span>{`\n`}
{`}`});{`\n\n`}

<span className="text-[#666]">{"// 2. Attach it as a global middleware"}</span>{`\n`}
app.<span className="text-yellow-200">use</span>(tars.<span className="text-yellow-200">analyzeTraffic</span>());{`\n\n`}

app.<span className="text-yellow-200">get</span>(<span className="text-green-300">'/'</span>, (req, res) {`=>`} {`{\n`}
  res.<span className="text-yellow-200">send</span>(<span className="text-green-300">"Your enterprise site is protected by TARS!"</span>);{`\n`}
{`}`});{`\n\n`}

app.<span className="text-yellow-200">listen</span>(<span className="text-purple-400">3001</span>);
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
