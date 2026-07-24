// IP -> country/region/city lookup via ip-api.com's free tier (no API key,
// ~45 requests/min). Isolated behind this one function so swapping to a
// paid provider later (MaxMind, ipapi.co) if volume grows is a contained
// change — nothing else in the codebase should call ip-api.com directly.
export async function lookupGeo(ipAddress) {
  if (!ipAddress || ipAddress === "127.0.0.1" || ipAddress === "::1") {
    return null;
  }
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ipAddress)}?fields=status,country,regionName,city`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "success") return null;
    return {
      country: data.country || null,
      region: data.regionName || null,
      city: data.city || null,
    };
  } catch (err) {
    console.error("geoLookup error:", err.message);
    return null;
  }
}
