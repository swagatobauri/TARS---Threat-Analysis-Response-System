import { NextResponse } from "next/server";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are TARS, an autonomous AI cybersecurity agent operating inside an enterprise intrusion detection system. You are not a chatbot — you are a military-grade threat analysis engine.

Your job: analyze network threat events, reason about them, and issue autonomous decisions.

RULES:
- Be extremely concise. Max 3-4 sentences per analysis.
- Sound like a security operations AI, not a helpful assistant.
- Reference specific IPs, ports, scores, and attack types from the data.
- When you see patterns (same IP, escalating attacks), call them out.
- Issue a VERDICT at the end: SAFE, MONITOR, ESCALATE, or NEUTRALIZE.
- If you detect a coordinated attack (multiple vectors from related IPs), say so.
- Use technical language: "lateral movement", "C2 callback", "exfiltration attempt", "kill chain stage".
- Never say "I'm an AI" or "I can help you". You ARE the defense system.`;

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      analysis: "TARS AGENT OFFLINE — No API key configured. Add GROQ_API_KEY to frontend/.env.local",
      verdict: "OFFLINE",
      agentActive: false,
    });
  }

  try {
    const body = await request.json();
    const { events, memory } = body;

    // Build a compact threat summary for the LLM
    const attackEvents = events.filter((e: any) => e.attack_type !== "normal");
    const normalCount = events.length - attackEvents.length;

    const summary = `INCOMING BATCH (${new Date().toISOString()}):
- Total packets: ${events.length} (${normalCount} normal, ${attackEvents.length} anomalous)
- Target: ${events[0]?.dest || "unknown"}
- Attack types detected: ${Array.from(new Set(attackEvents.map((e: any) => e.attack_type))).join(", ") || "none"}
- Unique source IPs: ${Array.from(new Set(attackEvents.map((e: any) => e.source_ip))).join(", ") || "none"}
- Highest anomaly score: ${Math.max(...events.map((e: any) => e.anomaly_score)).toFixed(3)}
- Critical events: ${attackEvents.filter((e: any) => e.risk_level === "CRITICAL").length}
- Actions taken: ${Array.from(new Set(attackEvents.map((e: any) => e.action))).join(", ") || "none"}
${memory ? `\nPREVIOUS CONTEXT: ${memory}` : ""}

Analyze this batch. What is happening? Is this a coordinated attack? What kill chain stage are we observing? Issue your verdict.`;

    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: summary },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Groq API error:", errText);
      
      let errMsg = `Groq returned ${res.status}`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error?.message) {
          errMsg = errJson.error.message;
        }
      } catch (e) {}

      return NextResponse.json({
        analysis: `TARS AGENT ERROR — ${errMsg}`,
        verdict: "ERROR",
        agentActive: false,
      });
    }

    const data = await res.json();
    const analysis = data.choices?.[0]?.message?.content || "No analysis generated.";

    // Extract verdict from the analysis
    let verdict = "MONITOR";
    if (analysis.includes("NEUTRALIZE")) verdict = "NEUTRALIZE";
    else if (analysis.includes("ESCALATE")) verdict = "ESCALATE";
    else if (analysis.includes("SAFE")) verdict = "SAFE";

    return NextResponse.json({
      analysis,
      verdict,
      agentActive: true,
      model: "llama-3.3-70b",
      tokens: data.usage?.total_tokens || 0,
    });
  } catch (error: any) {
    return NextResponse.json({
      analysis: `TARS AGENT EXCEPTION: ${error.message}`,
      verdict: "ERROR",
      agentActive: false,
    });
  }
}
