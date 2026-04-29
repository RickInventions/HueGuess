import { z } from 'zod';

export const competitiveSubmitSchema = z.object({
  roundId: z.string().uuid(),
  h: z.number().min(0).max(360),
  s: z.number().min(0).max(100),
  l: z.number().min(0).max(100),
  memorizationTime: z.number().min(0).max(30),
});

export const leaderboardQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'all-time']).optional().default('all-time'),
  limit: z.coerce.number().min(1).max(100).optional().default(100),
});