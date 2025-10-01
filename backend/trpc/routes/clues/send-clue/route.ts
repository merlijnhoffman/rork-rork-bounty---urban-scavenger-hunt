import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const sendClueProcedure = publicProcedure
  .input(
    z.object({
      eventId: z.string(),
      text: z.string().min(1, "Clue text is required"),
      hint: z.string().optional(),
      orderNumber: z.number().min(1, "Order number must be at least 1"),
      releaseTime: z.string().optional(), // ISO string, defaults to now
      adminKey: z.string(), // Simple admin authentication
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log("Sending clue for event:", input.eventId);

      // Simple admin authentication (in production, use proper auth)
      const expectedAdminKey = process.env.ADMIN_KEY || "admin123";
      if (input.adminKey !== expectedAdminKey) {
        throw new Error("Unauthorized: Invalid admin key");
      }

      // Use current time if no release time specified
      const releaseTime = input.releaseTime || new Date().toISOString();

      // Insert the clue into the database
      const { data: clue, error } = await supabase
        .from("clues")
        .insert({
          event_id: input.eventId,
          text: input.text,
          hint: input.hint,
          order_number: input.orderNumber,
          release_time: releaseTime,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Error inserting clue:", error);
        throw new Error("Failed to send clue");
      }

      console.log("Clue sent successfully:", clue.id);

      return {
        success: true,
        clue: {
          id: clue.id,
          text: clue.text,
          hint: clue.hint,
          orderNumber: clue.order_number,
          releaseTime: clue.release_time,
        },
        message: "Clue sent successfully"
      };
    } catch (error) {
      console.error("Error in sendClueProcedure:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to send clue");
    }
  });