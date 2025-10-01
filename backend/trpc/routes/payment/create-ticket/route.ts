import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import { createClient } from "@supabase/supabase-js";


const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function generateVerificationCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export const createTicketProcedure = publicProcedure
  .input(
    z.object({
      userId: z.string(),
      eventId: z.string(),
      paymentIntentId: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log("Creating ticket for:", input);

      const verificationCode = generateVerificationCode();

      const { data: ticket, error } = await supabase
        .from("tickets")
        .insert({
          user_id: input.userId,
          event_id: input.eventId,
          verification_code: verificationCode,
          is_used: false,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating ticket:", error);
        throw new Error("Failed to create ticket");
      }

      console.log("Ticket created:", ticket.id);

      return {
        ticketId: ticket.id,
        verificationCode: ticket.verification_code,
        eventId: ticket.event_id,
        userId: ticket.user_id,
        purchasedAt: ticket.purchased_at,
        isUsed: ticket.is_used,
      };
    } catch (error) {
      console.error("Error in createTicketProcedure:", error);
      throw new Error("Failed to create ticket");
    }
  });