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
