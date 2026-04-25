import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "TARS | Mission Control",
  description: "Autonomous Intrusion Response System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body 
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-[#0a0a0a] text-[#f5f5f5] flex h-screen overflow-hidden`}
      >
        <Sidebar />
        <main className="flex-1 h-screen overflow-y-auto pl-6 pr-8 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
