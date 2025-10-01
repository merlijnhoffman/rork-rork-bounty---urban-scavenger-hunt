import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const getUserTicketsProcedure = publicProcedure
  .input(
    z.object({
      userId: z.string(),
    })
  )
  .query(async ({ input }) => {
    try {
      console.log("Fetching tickets for user:", input.userId);

      const { data: tickets, error } = await supabase
        .from("tickets")
        .select(`
          *,
          events (
            id,
            city,
            date,
            start_time,
            price
          )
        `)
        .eq("user_id", input.userId)
        .order("purchased_at", { ascending: false });

      if (error) {
        console.error("Error fetching tickets:", error);
        throw new Error("Failed to fetch tickets");
      }

      console.log(`Found ${tickets.length} tickets for user`);

      return tickets.map(ticket => ({
        ticketId: ticket.id,
        verificationCode: ticket.verification_code,
        eventId: ticket.event_id,
        userId: ticket.user_id,
        purchasedAt: ticket.purchased_at,
        isUsed: ticket.is_used,
        event: ticket.events ? {
          id: ticket.events.id,
          city: ticket.events.city,
          date: ticket.events.date,
          startTime: ticket.events.start_time,
          price: ticket.events.price,
        } : null,
      }));
    } catch (error) {
      console.error("Error in getUserTicketsProcedure:", error);
      throw new Error("Failed to fetch user tickets");
    }
  });