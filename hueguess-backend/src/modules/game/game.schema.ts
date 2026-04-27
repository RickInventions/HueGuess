import { z } from 'zod';

export const startRoundSchema = z.object({
  mode: z.enum(['casual', 'competitive', 'challenge']).optional().default('casual'),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
});

export const submitColorSchema = z.object({
  roundId: z.string().uuid(),
  h: z.number().min(0).max(360),
  s: z.number().min(0).max(100),
  l: z.number().min(0).max(100),
});