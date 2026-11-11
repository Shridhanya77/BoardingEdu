import { NextRequest } from "next/server";
import { proxyToRender } from "@/lib/render-proxy";

export const dynamic = "force-dynamic";

type Context = { params: { path?: string[] } };

function proxy(request: NextRequest, context: Context) {
  const suffix = (context.params.path ?? []).filter(Boolean).join("/");
  return proxyToRender(request, suffix ? `/api/${suffix}/` : "/api/");
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
