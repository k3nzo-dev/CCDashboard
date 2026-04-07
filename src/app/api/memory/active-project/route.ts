import { NextResponse } from "next/server";
import { detectActiveProject } from "@/lib/memory-data";

export async function GET() {
  const result = detectActiveProject();
  return NextResponse.json(result);
}
