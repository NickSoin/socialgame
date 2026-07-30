import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeAuthRedirect } from "@/utils/auth-redirect";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const token_hash = searchParams.get("token_hash");
  const redirectPath = sanitizeAuthRedirect(searchParams.get("next"));

  if (token_hash) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
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
      const { error } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash,
      });

      if (!error) {
        return NextResponse.redirect(new URL(redirectPath, req.url));
      }
    } catch (error) {
      console.error("Failed to verify auth token:", error);
    }
  }

  // Return the user to the auth code error page when verification fails.
  return NextResponse.redirect(new URL("/auth/auth-code-error", req.url));
}
