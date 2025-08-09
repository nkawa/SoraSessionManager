export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { bus } from "@/lib/bus";

/**
 * Sora の認証 Webhook から叩かれる。
 * 常に 200 を返し、本文 JSON で allowed を返すのが仕様。
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const channelId: string | undefined = body?.channel_id;
  const connectionId: string | undefined = body?.connection_id;


  // ここに独自ロジック（APIキー検査、DB照会、レート制限など）
  // 認可ロジック（例）
  const allowed = !!channelId && channelId.startsWith("sora");
//  const allowed = channelId?.startsWith("sora") ?? false;


  // ここで SPA へ流したい情報を publish
  bus.emit("front", <const>{
    type: "auth_webhook.hit",
    channelId,
    connectionId,
    payload: { allowed },
  });

  if (!allowed) {
    // 拒否する場合は reason を含めるとログが親切
    return NextResponse.json(
      { allowed: false, reason: "channel_id policy" },
      { status: 200 }
    );
  }

  // 許可。任意で event_metadata を付けると後続のイベント Webhook にも載る
  return NextResponse.json(
    {
      allowed: true,
      event_metadata: { project: "my-app", channel: channelId },
    },
    { status: 200 }
  );
}

