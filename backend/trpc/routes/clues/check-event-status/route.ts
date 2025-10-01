import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const checkEventStatusProcedure = publicProcedure
  .input(
    z.object({
      eventId: z.string(),
    })
  )
  .query(async ({ input }) => {
    try {
      console.log("Checking event status for:", input.eventId);

      // Get event details
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", input.eventId)
        .single();

      if (eventError || !event) {
        console.log("Event not found");
        return {
          eventExists: false,
          isActive: false,
          startTime: null,
          message: "Event not found"
        };
      }

      // Check if event is currently active
      const now = new Date();
      const startTime = new Date(event.start_time);
      const endTime = new Date(startTime.getTime() + (event.duration_hours || 3) * 60 * 60 * 1000);

      const isActive = now >= startTime && now <= endTime;
      const hasStarted = now >= startTime;

      console.log(`Event status - Started: ${hasStarted}, Active: ${isActive}`);

      return {
        eventExists: true,
        isActive,
        hasStarted,
        startTime: event.start_time,
        endTime: endTime.toISOString(),
        city: event.city,
        prize: event.prize,
        message: isActive ? "Event is live" : hasStarted ? "Event has ended" : "Event hasn't started yet"
      };
    } catch (error) {
      console.error("Error in checkEventStatusProcedure:", error);
      throw new Error("Failed to check event status");
    }
  });