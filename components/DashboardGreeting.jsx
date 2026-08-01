"use client";

import { useEffect, useState } from "react";

function greetingForHour(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Renders a static "Ledger dashboard" fallback on the server (no access to
// the visitor's local clock there) and swaps in the time-of-day greeting
// once mounted in the browser, matching this codebase's existing
// server/client-mismatch avoidance pattern (state seeded null, filled in
// inside an effect).
export default function DashboardGreeting({ style }) {
  const [greeting, setGreeting] = useState(null);

  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  return <h1 style={style}>{greeting || "Welcome"} — welcome to your ledger dashboard</h1>;
}
