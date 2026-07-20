/**
 * Stream a sequence of JSON events to the browser as newline-delimited JSON
 * (NDJSON). The producer emits `{ type: "progress", … }` events as work
 * proceeds and a final `{ type: "result", result } | { type: "error", error }`.
 * The client reads them incrementally to drive a progress bar.
 */
export function ndjsonStream(
  producer: (emit: (event: unknown) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      // Heartbeat: a bare newline every 10s keeps the connection from going idle
      // during a long single model call (an idle stream can be dropped by the
      // browser/OS/proxy). Empty lines are ignored by the client parser.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode("\n"));
        } catch {
          // stream already closed
        }
      }, 10000);
      try {
        await producer(emit);
      } catch (e) {
        emit({ type: "error", error: e instanceof Error ? e.message : String(e) });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
