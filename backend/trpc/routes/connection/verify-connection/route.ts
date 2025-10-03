import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { connectionCodes } from "../generate-code/route";

const usedConnections = new Set<string>();

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export const verifyConnectionProcedure = publicProcedure
  .input(
    z.object({
      code: z.string(),
      scannerUserId: z.string(),
      scannerLatitude: z.number(),
      scannerLongitude: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const codeData = connectionCodes.get(input.code);

    if (!codeData) {
      throw new Error("Invalid or expired connection code");
    }

    if (codeData.expiresAt < Date.now()) {
      connectionCodes.delete(input.code);
      throw new Error("Connection code has expired");
    }

    if (codeData.userId === input.scannerUserId) {
      throw new Error("Cannot connect with yourself");
    }

    const connectionKey = [codeData.userId, input.scannerUserId]
      .sort()
      .join("-");

    if (usedConnections.has(connectionKey)) {
      throw new Error("You have already connected with this player");
    }

    const distance = calculateDistance(
      codeData.latitude,
      codeData.longitude,
      input.scannerLatitude,
      input.scannerLongitude
    );

    console.log(`Distance between players: ${distance}m`);

    if (distance > 5) {
      throw new Error(
        `Players must be within 5 meters of each other (current distance: ${Math.round(distance)}m)`
      );
    }

    usedConnections.add(connectionKey);
    connectionCodes.delete(input.code);

    console.log(
      `Connection successful between ${codeData.userId} and ${input.scannerUserId}`
    );

    return {
      success: true,
      generatorUserId: codeData.userId,
      scannerUserId: input.scannerUserId,
      distance: Math.round(distance),
    };
  });
