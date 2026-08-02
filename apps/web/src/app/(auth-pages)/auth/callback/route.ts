import { createServerClient } from "@supabase/ssr";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sanitizeAuthRedirect } from "@/utils/auth-redirect";
import { getAuthCookieOptions } from "@/supabase-clients/cookie-options";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectPath = sanitizeAuthRedirect(requestUrl.searchParams.get("next"));

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookieOptions: getAuthCookieOptions(),
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );

    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("Failed to exchange code for session:", error.message);
        return NextResponse.redirect(new URL("/auth/auth-code-error", requestUrl.origin));
      }
    } catch (error) {
      console.error("Failed to exchange code for session:", error);
      return NextResponse.redirect(new URL("/auth/auth-code-error", requestUrl.origin));
    }
  }

  revalidatePath("/", "layout");

  return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
}
