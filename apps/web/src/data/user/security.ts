"use server";
import { authActionClient } from "@/lib/safe-action";
import { createSupabaseClient } from "@/supabase-clients/server";
import { passwordSchema } from "@/utils/auth-validation";
import { z } from "zod";

const updatePasswordSchema = z.object({
  password: passwordSchema,
});

export const updatePasswordAction = authActionClient
  .schema(updatePasswordSchema)
  .action(async ({ parsedInput: { password } }) => {
    const supabaseClient = await createSupabaseClient();
    const { error } = await supabaseClient.auth.updateUser({
      password,
    });

    if (error) {
      throw new Error(error.message);
    }
  });
