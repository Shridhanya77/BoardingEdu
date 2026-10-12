import { NextRequest, NextResponse } from "next/server";
import { normalizeLocationPreferences } from "@/lib/location-preferences";

const COOKIE_NAME = "boardingu_location_preferences";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;
const MAX_BODY_LENGTH = 16_384;

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
    version: 1 as const,
    active_school_type_ids: [],
    preferences: {},
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

  return NextResponse.json(preferences, {
    headers: { "Cache-Control": "no-store" },
  });
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
  if (!preferences || preferences.active_school_type_ids.length === 0) {
    return NextResponse.json(
      { error: "Select a valid school type and location before saving." },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ saved: true });
  response.cookies.set(COOKIE_NAME, JSON.stringify(preferences), cookieOptions());
  return response;
}

export async function DELETE() {
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(COOKIE_NAME, "", { ...cookieOptions(), maxAge: 0 });
  return response;
}
