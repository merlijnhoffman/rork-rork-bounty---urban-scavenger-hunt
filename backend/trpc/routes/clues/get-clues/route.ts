import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const getCluesProcedure = publicProcedure
  .input(
    z.object({
      eventId: z.string(),
      userId: z.string(),
    })
  )
  .query(async ({ input }) => {
    try {
      console.log("Getting clues for event:", input.eventId, "user:", input.userId);

      // First, verify the user has a valid ticket for this event
      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .select("*")
        .eq("user_id", input.userId)
        .eq("event_id", input.eventId)
        .eq("is_used", false)
        .single();

      if (ticketError || !ticket) {
        console.log("No valid ticket found for user");
        return {
          hasAccess: false,
          clues: [],
          message: "No valid ticket found for this event"
        };
      }

      // Get all clues for this event that have been released
      const { data: clues, error: cluesError } = await supabase
        .from("clues")
        .select("*")
        .eq("event_id", input.eventId)
        .lte("release_time", new Date().toISOString())
        .order("order_number", { ascending: true });

      if (cluesError) {
        console.error("Error fetching clues:", cluesError);
        throw new Error("Failed to fetch clues");
      }

      console.log(`Found ${clues.length} released clues for event`);

      return {
        hasAccess: true,
        clues: clues.map(clue => ({
          id: clue.id,
          text: clue.text,
          hint: clue.hint,
          timestamp: new Date(clue.release_time).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }),
          order: clue.order_number,
          releaseTime: clue.release_time,
        })),
        message: "Clues retrieved successfully"
      };
    } catch (error) {
      console.error("Error in getCluesProcedure:", error);
      throw new Error("Failed to get clues");
    }
  });