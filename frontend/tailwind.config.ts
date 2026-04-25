import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        glow: "#ffffff",
        threat: "#ff4444",
        safe: "#00ff88",
        warn: "#ffaa00",
        background: "#0a0a0a",
        foreground: "#f5f5f5",
        muted: "#111111",
        "muted-foreground": "#888888",
        border: "#1a1a1a",
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'monospace'],
        sans: ['var(--font-inter)', 'sans-serif'],
      },
      boxShadow: {
        glow: "0 0 20px rgba(255,255,255,0.08)",
        "glow-threat": "0 0 20px rgba(255,68,68,0.15)",
      },
    },
  },
  plugins: [],
};
export default config;
