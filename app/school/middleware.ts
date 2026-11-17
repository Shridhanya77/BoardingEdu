// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only intercept /school/:slug requests
  const match = pathname.match(/^\/school\/([^/]+)\/?$/);
  if (!match) return NextResponse.next();

  const slug = match[1];

  // Check if this is a known old slug
  const res = await fetch(
    `${process.env.API_URL}/api/v1/schools/resolve-slug/?slug=${slug}`,
    { next: { revalidate: 86400 } },  // cache for 24h
  );

  if (!res.ok) return NextResponse.next();

  const data = await res.json() as { current_slug: string | null };
  if (!data.current_slug || data.current_slug === slug) {
    return NextResponse.next();
  }

  // 301 permanent redirect to current URL
  const url = request.nextUrl.clone();
  url.pathname = `/school/${data.current_slug}/`;
  return NextResponse.redirect(url, 301);
}

export const config = {
  matcher: ['/school/:path*'],
};