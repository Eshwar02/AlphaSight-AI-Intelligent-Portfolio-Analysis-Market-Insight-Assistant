import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type SetAllCookies } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login", "/signup", "/auth/callback", "/api/daily-brief"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiPath = pathname.startsWith("/api/");

  let response: NextResponse;
  try {
    // First, refresh the session (updates cookies)
    response = await updateSession(request);
  } catch (error) {
    console.error("[middleware] session refresh failed", error);
    // Never block API routes at middleware layer; API handlers enforce auth.
    if (isApiPath) {
      return NextResponse.next({ request });
    }
    response = NextResponse.next({ request });
  }

  // API routes should not be redirected by middleware.
  // Their handlers return JSON 401/500 responses as needed.
  if (isApiPath) {
    return response;
  }

  // Build a lightweight Supabase client from the *response* cookies
  // so we read the freshly-refreshed tokens.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  let user = null;
  try {
    const {
      data: { user: resolvedUser },
    } = await supabase.auth.getUser();
    user = resolvedUser;
  } catch (error) {
    console.error("[middleware] auth user check failed", error);
  }

  const isPublicPath = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  // Unauthenticated user trying to access protected route
  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user visiting login or signup — send them home
  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon)
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
