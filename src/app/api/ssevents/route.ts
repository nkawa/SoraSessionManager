export const runtime = "nodejs";
import { bus } from "@/lib/bus";
import { on } from "events";

export async function GET(req: Request) {
  // クライアント識別したい場合は ?clientId=... などを使う
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };
      // 接続直後に ping
      send({ type: "connected", ts: Date.now() });
      console.log("SSE connection established in server");
     
      const onEvent = (evt: unknown) =>{
        send(evt);
//        console.log("Server:SSE event:", evt);
      } 

      bus.on("front", onEvent);

      const heartbeat = setInterval(() => {
        controller.enqueue(new TextEncoder().encode(`: ping\n\n`));
        console.log("SSE heartbeat ping");
      }, 15000);

      const cancel = () => {
        clearInterval(heartbeat);
        console.log("SSE connection closed");
        bus.off("front", onEvent);
        controller.close();
      };

      // 接続終了時のハンドラ
      req.signal.addEventListener("abort", cancel, {once: true});

//      (req as any).signal?.addEventListener?.("abort", cancel);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginxでバッファ無効化
    },
  });
}
