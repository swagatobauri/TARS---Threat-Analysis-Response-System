import { NextResponse } from "next/server";

export async function GET() {
  try {
    // This runs on the Next.js server, completely bypassing browser ad-blockers like Brave or uBlock!
    // We fetch the public IP details here and pass it back to our own frontend.
    const res = await fetch("https://ipapi.co/json/");
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch IP details" }, { status: 500 });
  }
}
