// app/api/recording/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TARGET = process.env.SORA_API_URL;
const ORIGIN = process.env.ALLOW_ORIGIN;

const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-sora-target"
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

type StartBody = {
  channel_id: string;
  format?: "mp4" | "webm";
  expire_time?: number;       // 1..86400 (秒)
  split_duration?: number;    // 1..86400 (秒)
  split_only?: boolean;       // true の場合 split_duration 必須
  metadata?: any;
};

type StopBody = {
  channel_id: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json() as StartBody | StopBody;

    const isStart = body.split_only !== undefined || body.format !== undefined;
    const target = isStart
      ? "Sora_20231220.StartRecording"
      : "Sora_20231220.StopRecording";

    // 上流にそのまま転送（Start の場合はオプション含む）
    const upstream = await fetch(TARGET, {
      method: "POST",
      headers: {
        "x-sora-target": target,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        ...CORS,
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json"
      }
    });
  } catch (e: any) {
    return new NextResponse(JSON.stringify({ error: e?.message ?? "recording api failed" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" }
    });
  }
}
