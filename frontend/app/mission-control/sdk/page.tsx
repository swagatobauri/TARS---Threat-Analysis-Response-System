import React from "react";
import { TerminalSquare, ShieldCheck, Zap, Lock, Code, Copy, CheckCircle2 } from "lucide-react";

export default function SDKIntegrationPage() {
  return (
    <div className="min-h-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 md:p-12 text-gray-900 font-sans mt-2 mr-2">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <header className="border-b border-gray-200 pb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <TerminalSquare className="text-blue-600 w-7 h-7" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
              TARS SDK Integration
            </h1>
          </div>
          <p className="text-gray-600 text-lg leading-relaxed max-w-3xl">
            Embed TARS directly into your enterprise web infrastructure. The SDK acts as a lightweight, non-blocking 
            middleware that streams real-time traffic metadata to your self-hosted Mission Control for autonomous threat analysis.
          </p>
        </header>

        {/* Why Use TARS SDK */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            Why Use The SDK?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl hover:shadow-md transition-shadow">
              <Zap className="w-6 h-6 text-yellow-500 mb-4" />
              <h3 className="text-gray-900 font-semibold mb-2">Zero Latency</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Operates asynchronously in monitoring mode. It batches and flushes logs to the TARS backend 
                without blocking or slowing down your user requests.
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl hover:shadow-md transition-shadow">
              <Lock className="w-6 h-6 text-blue-500 mb-4" />
              <h3 className="text-gray-900 font-semibold mb-2">Total Data Privacy</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Because TARS is self-hosted, your enterprise traffic logs never leave your private cloud. 
                No third-party SaaS vendors snooping on your data.
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl hover:shadow-md transition-shadow">
              <ShieldCheck className="w-6 h-6 text-green-500 mb-4" />
              <h3 className="text-gray-900 font-semibold mb-2">Instant AI Protection</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Immediately connects your website to the TARS Autonomous Agent, giving you real-time anomaly 
                scoring, kill-chain tracking, and automated response.
              </p>
            </div>
          </div>
        </section>

        <hr className="border-gray-200" />

        {/* Installation & Configuration */}
        <section className="space-y-8">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Code className="w-5 h-5 text-gray-500" />
              1. Installation
            </h2>
            <p className="text-gray-600 text-sm mb-4">Install the official Node.js SDK via NPM or Yarn.</p>
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg flex items-center justify-between group">
              <code className="text-sm font-mono text-gray-800">npm install tars-sdk-node</code>
              <button className="text-gray-400 hover:text-gray-600 transition-colors">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-gray-500" />
              2. Configuration
            </h2>
            <p className="text-gray-600 text-sm mb-4 leading-relaxed">
              The SDK must be initialized with your self-hosted TARS Backend URL. 
              It acts as an Express.js middleware, meaning it should be placed before your application routes.
            </p>

            <div className="bg-[#1e1e1e] rounded-xl overflow-hidden shadow-sm">
              <div className="bg-[#2d2d2d] px-4 py-3 border-b border-[#3d3d3d] flex justify-between items-center">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <span className="text-gray-400 font-mono text-xs">server.js (Express)</span>
                <button className="text-gray-400 hover:text-white transition-colors">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 overflow-x-auto text-sm font-mono text-[#d4d4d4] leading-relaxed">
                <pre>
<span className="text-[#569cd6]">const</span> express = <span className="text-[#dcdcaa]">require</span>(<span className="text-[#ce9178]">'express'</span>);{`\n`}
<span className="text-[#569cd6]">const</span> {`{ TarsMiddleware }`} = <span className="text-[#dcdcaa]">require</span>(<span className="text-[#ce9178]">'tars-sdk-node'</span>);{`\n\n`}

<span className="text-[#569cd6]">const</span> app = <span className="text-[#dcdcaa]">express</span>();{`\n\n`}

<span className="text-[#6a9955]">{"// 1. Initialize the SDK with your self-hosted TARS URL"}</span>{`\n`}
<span className="text-[#569cd6]">const</span> tars = <span className="text-[#569cd6]">new</span> <span className="text-[#4ec9b0]">TarsMiddleware</span>({`{\n`}
  <span className="text-[#9cdcfe]">serverUrl</span>: <span className="text-[#ce9178]">'http://localhost:8000'</span>,{`\n`}
  <span className="text-[#9cdcfe]">apiKey</span>: <span className="text-[#ce9178]">'optional-api-key'</span>,{`\n`}
  <span className="text-[#9cdcfe]">mode</span>: <span className="text-[#ce9178]">'monitoring'</span>, <span className="text-[#6a9955]">{"// Async analysis"}</span>{`\n`}
  <span className="text-[#9cdcfe]">batchSize</span>: <span className="text-[#b5cea8]">10</span>,{`\n`}
  <span className="text-[#9cdcfe]">flushInterval</span>: <span className="text-[#b5cea8]">5000</span>{`\n`}
{`}`});{`\n\n`}

<span className="text-[#6a9955]">{"// 2. Attach it as a global middleware"}</span>{`\n`}
app.<span className="text-[#dcdcaa]">use</span>(tars.<span className="text-[#dcdcaa]">analyzeTraffic</span>());{`\n\n`}

app.<span className="text-[#dcdcaa]">get</span>(<span className="text-[#ce9178]">'/'</span>, (req, res) {`=>`} {`{\n`}
  res.<span className="text-[#dcdcaa]">send</span>(<span className="text-[#ce9178]">"Your enterprise site is protected by TARS!"</span>);{`\n`}
{`}`});{`\n\n`}

app.<span className="text-[#dcdcaa]">listen</span>(<span className="text-[#b5cea8]">3001</span>);
                </pre>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
