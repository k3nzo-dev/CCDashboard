import { NextResponse } from "next/server";
import { writeClaudeMd } from "@/lib/memory-data";

export async function PUT(request: Request) {
  const body = await request.json();
  const { project, content } = body as { project: string; content: string };

  if (!project || typeof content !== "string") {
    return NextResponse.json({ ok: false, error: "Missing project or content" }, { status: 400 });
  }

  const result = writeClaudeMd(project, content);
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}
