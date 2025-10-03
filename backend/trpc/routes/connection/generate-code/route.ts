import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import crypto from "crypto";

const connectionCodes = new Map<string, {
  userId: string;
  eventId: string;
  latitude: number;
  longitude: number;
  expiresAt: number;
}>();

setInterval(() => {
  const now = Date.now();
  for (const [code, data] of connectionCodes.entries()) {
    if (data.expiresAt < now) {
      connectionCodes.delete(code);
    }
  }
}, 10000);

export const generateConnectionCodeProcedure = publicProcedure
  .input(
    z.object({
      userId: z.string(),
      eventId: z.string(),
      latitude: z.number(),
      longitude: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const code = crypto.randomBytes(16).toString("hex");
    const expiresAt = Date.now() + 60000;

    connectionCodes.set(code, {
      userId: input.userId,
      eventId: input.eventId,
      latitude: input.latitude,
      longitude: input.longitude,
      expiresAt,
    });

    console.log(`Generated connection code for user ${input.userId}:`, code);

    return {
      code,
      expiresAt,
    };
  });

export { connectionCodes };
