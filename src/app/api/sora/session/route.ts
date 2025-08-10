export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { bus } from "@/lib/bus";

export async function POST(req: Request) {
  const payload = await req.json().catch(() => ({}));
  const type = payload?.type as string | undefined; // 例: "session.created", "recording.started"
  console.log("Session POST received", type);

  if (type === "session.created") {
    // 例: セッションID/チャネルIDを保存してUIに反映
    bus?.emit?.("front", { type, payload });
  } else if (type === "recording.started") {
    // セッション由来の録画開始通知
    bus?.emit?.("front", { type, payload });
  }else if (type === "session.updated") {
//    console.log("Session updated event received");
  }else{
    console.log("Other Session event")
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}

