declare namespace Deno {
  export function serve(
    handler: (request: Request) => Response | Promise<Response>
  ): void;

  export namespace env {
    export function get(key: string): string | undefined;
  }
}

declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(
    handler: (request: Request) => Response | Promise<Response>
  ): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export function createClient(
    url: string,
    key: string,
    options?: Record<string, unknown>
  ): {
    auth: {
      getUser(token: string): Promise<{ data: { user: { id: string } | null } | null; error: Error | null }>;
      admin: {
        deleteUser(userId: string): Promise<{ error: Error | null }>;
      };
    };
    from(table: string): {
      delete(): { eq(field: string, value: string): Promise<{ error: Error | null }> };
    };
  };
}
