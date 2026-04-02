import { z } from 'zod';

export const SelftuneVideoSchema = z.object({
  accentColor: z.string().default('#8b5cf6'),
});

export type SelftuneVideoProps = z.infer<typeof SelftuneVideoSchema>;
