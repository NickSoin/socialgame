import { z } from 'zod';

export const publicNicknameSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, 'Enter a public nickname.')
    .max(50, 'Public nickname must be 50 characters or fewer.'),
});

export type PublicNicknameInput = z.infer<typeof publicNicknameSchema>;
