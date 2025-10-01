import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import { createPaymentIntentProcedure } from "./routes/payment/create-intent/route";
import { createTicketProcedure } from "./routes/payment/create-ticket/route";
import { getUserTicketsProcedure } from "./routes/payment/get-user-tickets/route";
import { checkTicketStatusProcedure } from "./routes/payment/check-ticket-status/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  payment: createTRPCRouter({
    createIntent: createPaymentIntentProcedure,
    createTicket: createTicketProcedure,
    getUserTickets: getUserTicketsProcedure,
    checkTicketStatus: checkTicketStatusProcedure,
  }),
});

export type AppRouter = typeof appRouter;
