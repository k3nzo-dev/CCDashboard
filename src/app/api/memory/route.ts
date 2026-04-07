import { NextResponse } from "next/server";
import { getProjectMemory, getAllProjectsForPicker } from "@/lib/memory-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const project = searchParams.get("project");

  if (!project) {
    // No project specified — return all projects for picker
    const projects = getAllProjectsForPicker();
    return NextResponse.json({ projects });
  }

  const data = getProjectMemory(project);
  return NextResponse.json(data);
}
