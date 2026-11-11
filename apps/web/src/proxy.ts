import { NextResponse, type NextRequest } from "next/server";
import { isLocale, negotiateLocale } from "@santa/core/i18n";

/** Sends "/" (and any unprefixed page path) to the visitor's language: /en or /fr. */
export function proxy(request: NextRequest) {
  const [, first] = request.nextUrl.pathname.split("/");
  if (isLocale(first)) return NextResponse.next();
  const locale = negotiateLocale(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Pages only: skip API routes, Next internals and static files.
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};
