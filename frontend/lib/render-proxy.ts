import { NextRequest, NextResponse } from "next/server";

const RENDER_ORIGIN = "https://boardingedu-backend.onrender.com";

const DROPPED_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-forwarded-for",
]);

export function renderOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE ?? "";
  const base = !configured || configured.includes("railway.app")
    ? `${RENDER_ORIGIN}/api`
    : configured;
  return base.replace(/\/+$/, "").replace(/\/api$/i, "");
}

export async function proxyToRender(request: NextRequest, upstreamPath: string): Promise<NextResponse> {
  const target = new URL(upstreamPath.replace(/\/{2,}/g, "/"), `${renderOrigin()}/`);
  if (!target.pathname.endsWith("/")) target.pathname += "/";
  target.search = request.nextUrl.search;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!DROPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  const method = request.method.toUpperCase();
  const upstream = await fetch(target, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
    redirect: "manual",
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const name = key.toLowerCase();
    if (name !== "content-encoding" && name !== "transfer-encoding" && name !== "content-length") {
      responseHeaders.set(key, value);
    }
  });
  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}
