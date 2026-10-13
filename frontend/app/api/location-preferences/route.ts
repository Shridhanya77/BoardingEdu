import { NextRequest, NextResponse } from "next/server";
import { normalizeLocationPreferences } from "@/lib/location-preferences";

const COOKIE_NAME = "boardingu_location_preferences";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;
const MAX_BODY_LENGTH = 16_384;
const MAX_COOKIE_LENGTH = 3_500;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

function emptyPreferences() {
  return {
    version: 2 as const,
    countries: [],
    updated_at: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const raw = request.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return NextResponse.json(emptyPreferences());

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    const response = NextResponse.json(emptyPreferences());
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  const preferences = normalizeLocationPreferences(decoded);
  if (!preferences) {
    const response = NextResponse.json(emptyPreferences());
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  const response = NextResponse.json(preferences, {
    headers: { "Cache-Control": "no-store" },
  });
  if (isRecord(decoded) && decoded.version !== 2) {
    response.cookies.set(COOKIE_NAME, JSON.stringify(preferences), cookieOptions());
  }
  return response;
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_LENGTH) {
    return NextResponse.json(
      { error: "Location preferences are too large." },
      { status: 413 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid location preference data." },
      { status: 400 },
    );
  }

  const preferences = normalizeLocationPreferences(payload);
  if (!preferences) {
    return NextResponse.json(
      { error: "Invalid location preference data." },
      { status: 400 },
    );
  }

  const serialized = JSON.stringify(preferences);
  if (preferences.countries.length > 0 && serialized.length > MAX_COOKIE_LENGTH) {
    return NextResponse.json(
      { error: "Reduce the number of saved states before saving preferences." },
      { status: 413 },
    );
  }

  const response = NextResponse.json({ saved: true });
  if (preferences.countries.length === 0) {
    response.cookies.set(COOKIE_NAME, "", { ...cookieOptions(), maxAge: 0 });
  } else {
    response.cookies.set(COOKIE_NAME, serialized, cookieOptions());
  }
  return response;
}

export async function DELETE() {
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(COOKIE_NAME, "", { ...cookieOptions(), maxAge: 0 });
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
