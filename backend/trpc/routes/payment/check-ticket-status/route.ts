import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const checkTicketStatusProcedure = publicProcedure
  .input(
    z.object({
      userId: z.string(),
      eventId: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    try {
      console.log("Checking ticket status for user:", input.userId);

      // Build query
      let query = supabase
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
        .eq("is_used", false)
        .order("purchased_at", { ascending: false });

      // Add event filter if provided
      if (input.eventId) {
        query = query.eq("event_id", input.eventId);
      }

      const { data: tickets, error } = await query;

      if (error) {
        console.error("Error checking ticket status:", error);
        throw new Error("Failed to check ticket status");
      }

      console.log(`Found ${tickets.length} active tickets for user`);

      // Return the most recent ticket if any exist
      const activeTicket = tickets.length > 0 ? tickets[0] : null;

      return {
        hasTicket: tickets.length > 0,
        ticketCount: tickets.length,
        activeTicket: activeTicket ? {
          ticketId: activeTicket.id,
          verificationCode: activeTicket.verification_code,
          eventId: activeTicket.event_id,
          userId: activeTicket.user_id,
          purchasedAt: activeTicket.purchased_at,
          isUsed: activeTicket.is_used,
          event: activeTicket.events ? {
            id: activeTicket.events.id,
            city: activeTicket.events.city,
            date: activeTicket.events.date,
            startTime: activeTicket.events.start_time,
            price: activeTicket.events.price,
          } : null,
        } : null,
        allTickets: tickets.map(ticket => ({
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
        })),
      };
    } catch (error) {
      console.error("Error in checkTicketStatusProcedure:", error);
      throw new Error("Failed to check ticket status");
    }
  });