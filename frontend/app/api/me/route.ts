import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // 1. Get the actual visitor's IP address from the request headers
    let clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip");
    
    // If running on localhost, use an empty string so the API just returns your home router's public IP
    if (!clientIp || clientIp === "::1" || clientIp.includes("127.0.0.1")) {
      clientIp = ""; 
    }

    // 2. Fetch the exact location data for the visitor's IP
    const url = clientIp ? `http://ip-api.com/json/${clientIp}` : "http://ip-api.com/json/";
    const res = await fetch(url);
    const data = await res.json();
    
    // 3. Normalize the data so the frontend map and UI can read it properly
    const normalizedData = {
      ip: data.query,
      org: data.isp || data.org || "Unknown ISP",
      city: data.city,
      region: data.regionName,
      country_name: data.country,
      latitude: data.lat,
      longitude: data.lon,
      timeZone: data.timezone
    };

    return NextResponse.json(normalizedData);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch IP details" }, { status: 500 });
  }
}
