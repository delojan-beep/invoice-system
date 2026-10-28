import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runJobs } from "@/src/jobs/jobs";

// Vercel Cron calls this every 15 minutes (vercel.json) with
// "Authorization: Bearer <CRON_SECRET>". Each job decides whether it is due.
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return new NextResponse("Unauthorized", { status: 401 });

  // Outside production, ?now=<ISO time> runs the jobs as if it were that moment.
  const override = process.env.NODE_ENV !== "production" ? request.nextUrl.searchParams.get("now") : null;
  const now = override ? new Date(override) : new Date();
  if (Number.isNaN(now.getTime())) return new NextResponse("Bad ?now", { status: 400 });

  const results = await runJobs(now);
  return NextResponse.json(
    { ranAt: now.toISOString(), results },
    { status: results.every((r) => r.ok) ? 200 : 500 },
  );
}
