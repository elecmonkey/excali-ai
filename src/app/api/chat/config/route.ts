import { NextResponse } from "next/server";

export async function GET() {
  const hasServerConfig = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_BASE && process.env.OPENAI_MODEL);
  return NextResponse.json({
    hasServerConfig,
    baseURL: process.env.OPENAI_API_BASE || null,
    model: process.env.OPENAI_MODEL || null,
  });
}
