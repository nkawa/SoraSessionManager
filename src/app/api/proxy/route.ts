import { NextResponse } from "next/server";

export const runtime = "nodejs"; // EdgeでもOKだがfetchオプションの自由度優先でnodejs


// 環境変数から API URL を取得
const API_URL = process.env.NEXT_PUBLIC_SORA_API_URL;

const TARGET = process.env.SORA_API_URL;
const ORIGIN = process.env.ALLOW_ORIGIN;

const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-sora-target"
};


// Preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// POST only（Sora API を中継）
export async function POST(req: Request) {
  try {
    const bodyText = await req.text(); // 透過
    const upstream  = await fetch(TARGET, {
      method: "POST",
      headers: {
        "x-sora-target": "Sora_20231220.ListSessions",
        "Content-Type": "application/json",
        // 必要ならここに認証ヘッダなどを追加
      },
      body:bodyText && bodyText.trim().length ? bodyText : "{}"
    });

    const text = await upstream.text(); // ← 配列(JSON文字列)をそのまま返す
    return new NextResponse(text, {
      status: upstream.status,
      headers: { ...CORS, "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" }
    });
  } catch (e: any) {
    return new NextResponse(JSON.stringify({ error: e?.message ?? "proxy failed" }), {
      status: 502,
      headers: { ...CORS, "Content-Type": "application/json" }
    });
  }
}

// 任意：GET 等に403返す（誤使用防止）
export async function GET() {
  return new NextResponse(JSON.stringify({ error: "Method Not Allowed" }), {
    status: 405,
    headers: { ...CORS, "Content-Type": "application/json" }
  });
}