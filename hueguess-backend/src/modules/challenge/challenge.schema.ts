import { z } from 'zod';

export const createRoomSchema = z.object({
  roundDuration: z.number()
    .min(10, 'Round duration must be at least 10 seconds')
    .max(45, 'Round duration must be at most 45 seconds')
    .default(25),
  colorDuration: z.number()
    .min(1, 'Color display time must be at least 1 second')
    .max(10, 'Color display time must be at most 10 seconds')
    .default(5),
});

export const joinRoomSchema = z.object({
  code: z.string()
    .length(8, 'Room code must be 8 characters')
    .regex(/^[0-9A-Fa-f]+$/, 'Room code must be hex'),
});

export const submitColorSchema = z.object({
  roundNumber: z.number().min(1),
  h: z.number().min(0).max(360),
  s: z.number().min(0).max(100),
  l: z.number().min(0).max(100),
  timeTaken: z.number().min(0),
});