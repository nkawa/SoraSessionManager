// Node ランタイムを明示（Edge だと一部 Node API が使えない）
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { bus } from "@/lib/bus";


export async function POST(req: Request) {
  // ヘッダーでイベント種別やIDが来る（あれば利用）
  const eventType = req.headers.get("sora-event-webhook-type"); // 例: connection.created
  const sessionId = req.headers.get("sora-session-id") || undefined;
  const connectionId = req.headers.get("sora-connection-id") || undefined;
  console.log("Event webhook POST", eventType, sessionId, connectionId);
  // 本文は JSON
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    // Sora は 200台以外やタイムアウトを「失敗」とみなすので、基本は 200 で返す
    // （ここではログだけ吐いて 200）
    console.error("Invalid JSON from Sora event webhook");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

//  console.log("Event Payload is ", payload);

  // ここでイベント種別ごとに処理を振り分け
  switch (eventType || payload?.type) {
    case "connection.created":
      // 例: 接続開始のハンドリング
//      console.log("Connection created event received", payload);
      bus.emit("front", { type: "connection.created", payload });
      break;
    case "connection.updated":
      // これ何に使うの？生きてるとき？
      break;
    case "connection.destroyed":
      bus.emit("front", { type: "connection.destroyed", payload });
      break;
    case "recording.started":
    case "recording.report":
      console.log("Recording event received", payload);
      break;
    default:
      // 未知イベントは無視
      bus.emit("front", <const>{
        type: "event_webhook.hit",
        eventType,
        sessionId,
        connectionId
      });
      break;
  }

  // できるだけ早く 200 を返す（重い処理はキュー等に回す）
  return NextResponse.json({ ok: true }, { status: 200 });
}
