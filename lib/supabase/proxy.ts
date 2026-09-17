import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;
  const isAdminPage = pathname.startsWith("/admin/") && !pathname.startsWith("/admin/login");
  const isAdminApi = pathname.startsWith("/api/admin/");
  const isRestaurantProtected = pathname.startsWith("/restaurant/dashboard/") || pathname.startsWith("/restaurant/bid/");

  // Admin login remains publicly reachable.
  if (!isAdminPage && !isAdminApi && !isRestaurantProtected) {
    return supabaseResponse;
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      if (isAdminApi) {
        return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
      }

      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = isAdminPage ? "/admin/login" : "/restaurant/login";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }

    if (isAdminPage || isAdminApi) {
      const { data: adminUser, error: adminError } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError) {
        console.error("ADMIN AUTHZ PROXY ERROR:", adminError);
        if (isAdminApi) {
          return NextResponse.json({ error: "Unable to verify admin access." }, { status: 500 });
        }
        return NextResponse.redirect(new URL("/admin/login", request.url));
      }

      if (!adminUser) {
        if (isAdminApi) {
          return NextResponse.json({ error: "Admin access required." }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/admin/login", request.url));
      }
    }
  } catch (error) {
    console.error("AUTH PROXY ERROR:", error);

    if (isAdminApi) {
      return NextResponse.json({ error: "Authentication check failed." }, { status: 500 });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = isAdminPage ? "/admin/login" : "/restaurant/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  // Never cache authenticated dashboard/admin responses.
  supabaseResponse.headers.set("Cache-Control", "private, no-store");

  return supabaseResponse;
}
