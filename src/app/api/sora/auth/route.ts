export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { bus } from "@/lib/bus";

/**
 * Sora の認証 Webhook から叩かれる。
 * 常に 200 を返し、本文 JSON で allowed を返すのが仕様。
 */
export async function POST(req: Request) {
//  console.log("Autho POST",req)
  const body = await req.json().catch(() => ({}));
  console.log("Auth POST body", body);
  const channelId: string | undefined = body?.channel_id;
  const connectionId: string | undefined = body?.connection_id;

  // ここに独自ロジック（APIキー検査、DB照会、レート制限など）
  const allowed = !!channelId;
//  const allowed = channelId?.startsWith("sora") ?? false;
// ここで、キーのチェックなどを行うことで、任意の接続を止められる

 console.log("Auth POST channelId", channelId, "connectionId", connectionId, "allowed", allowed);


  if (!allowed) {
    // 拒否する場合は reason を含めるとログが親切
    console.log("Disallowed channel_id:", channelId);
    return NextResponse.json(
      { allowed: false, reason: "channel_id policy" },
      { status: 200 }
    );
  }

  // 許可した場合だけ
  // ここで SPA へ流したい情報を publish
  bus.emit("front", <const>{
    type: "auth_webhook.hit",
    channelId,
    connectionId,
    payload: { allowed },
  });


  // 許可。任意で event_metadata を付けると後続のイベント Webhook にも載る
  return NextResponse.json(
    {
      allowed: true,
      event_metadata: { project: "my-app", channel: channelId },
    },
    { status: 200 }
  );
}

