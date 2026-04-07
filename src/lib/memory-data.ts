import fs from "fs";
import path from "path";
import os from "os";
import type {
  MemoryFile,
  MemoryFileFrontmatter,
  MemoryIndexEntry,
  ProjectMemoryData,
  ActiveProjectInfo,
  ProjectPickerItem,
} from "./types";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

/** Decode encoded project dir name back to filesystem path */
function decodeProjectPath(dirName: string): string {
  return dirName.replace(/^-/, "/").replace(/-/g, "/");
}

/** Extract display name from encoded dir name */
function getProjectDisplayName(dirName: string): string {
  const fullPath = decodeProjectPath(dirName);
  const parts = fullPath.split("/").filter(Boolean);
  return parts[parts.length - 1] || dirName;
}

/** Parse YAML-like frontmatter from a markdown file */
function parseFrontmatter(content: string): { frontmatter: MemoryFileFrontmatter | null; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: content };

  const yamlBlock = match[1];
  const body = match[2].trim();

  const name = yamlBlock.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const description = yamlBlock.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const type = yamlBlock.match(/^type:\s*(.+)$/m)?.[1]?.trim() as MemoryFileFrontmatter["type"] ?? "project";

  if (!name) return { frontmatter: null, body: content };

  return { frontmatter: { name, description, type }, body };
}

/** Parse MEMORY.md index file into entries */
function parseMemoryIndex(content: string): MemoryIndexEntry[] {
  const entries: MemoryIndexEntry[] = [];
  for (const line of content.split("\n")) {
    // Format: - [Title](file.md) — description
    const match = line.match(/^-\s+\[(.+?)\]\((.+?)\)\s*[—–-]\s*(.+)$/);
    if (match) {
      entries.push({ title: match[1], file: match[2], description: match[3].trim() });
    }
  }
  return entries;
}

/** Get all memory data for a project */
export function getProjectMemory(encodedName: string): ProjectMemoryData {
  const projectDir = path.join(PROJECTS_DIR, encodedName);
  const memoryDir = path.join(projectDir, "memory");

  // Parse MEMORY.md index
  let memoryIndex: MemoryIndexEntry[] = [];
  const memoryIndexPath = path.join(memoryDir, "MEMORY.md");
  if (fs.existsSync(memoryIndexPath)) {
    const content = fs.readFileSync(memoryIndexPath, "utf-8");
    memoryIndex = parseMemoryIndex(content);
  }

  // Parse individual memory files
  const memoryFiles: MemoryFile[] = [];
  if (fs.existsSync(memoryDir)) {
    const files = fs.readdirSync(memoryDir).filter(
      (f) => f.endsWith(".md") && f !== "MEMORY.md"
    );
    for (const filename of files) {
      const raw = fs.readFileSync(path.join(memoryDir, filename), "utf-8");
      const { frontmatter, body } = parseFrontmatter(raw);
      memoryFiles.push({ filename, frontmatter, content: body });
    }
  }

  // Read CLAUDE.md from the actual project working directory
  const realProjectPath = decodeProjectPath(encodedName);
  const claudeMdPath = path.join(realProjectPath, "CLAUDE.md");
  let claudeMd: string | null = null;
  if (fs.existsSync(claudeMdPath)) {
    claudeMd = fs.readFileSync(claudeMdPath, "utf-8");
  }

  return {
    memoryIndex,
    memoryFiles,
    claudeMd,
    claudeMdPath: fs.existsSync(claudeMdPath) ? claudeMdPath : null,
  };
}

/** Write CLAUDE.md content to the project's working directory */
export function writeClaudeMd(encodedName: string, content: string): { ok: boolean; error?: string } {
  const realProjectPath = decodeProjectPath(encodedName);
  const claudeMdPath = path.join(realProjectPath, "CLAUDE.md");

  // Safety: only write if the directory exists (real project path)
  if (!fs.existsSync(realProjectPath)) {
    return { ok: false, error: "Project directory not found" };
  }

  try {
    fs.writeFileSync(claudeMdPath, content, "utf-8");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Write failed" };
  }
}

/** Detect the most recently active project by JSONL modification time */
export function detectActiveProject(): ActiveProjectInfo {
  if (!fs.existsSync(PROJECTS_DIR)) {
    return { activeProject: null, encodedName: null, lastActivity: null };
  }

  let latestTime = 0;
  let latestDir = "";

  const projectDirs = fs.readdirSync(PROJECTS_DIR).filter((d) => {
    const full = path.join(PROJECTS_DIR, d);
    return fs.statSync(full).isDirectory();
  });

  for (const dir of projectDirs) {
    const dirPath = path.join(PROJECTS_DIR, dir);
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".jsonl"));
    for (const file of files) {
      const stat = fs.statSync(path.join(dirPath, file));
      if (stat.mtimeMs > latestTime) {
        latestTime = stat.mtimeMs;
        latestDir = dir;
      }
    }
  }

  if (!latestDir) {
    return { activeProject: null, encodedName: null, lastActivity: null };
  }

  return {
    activeProject: getProjectDisplayName(latestDir),
    encodedName: latestDir,
    lastActivity: new Date(latestTime).toISOString(),
  };
}

/** Get all projects for the picker view */
export function getAllProjectsForPicker(): ProjectPickerItem[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];

  const projectDirs = fs.readdirSync(PROJECTS_DIR).filter((d) => {
    const full = path.join(PROJECTS_DIR, d);
    return fs.statSync(full).isDirectory();
  });

  return projectDirs
    .map((dir) => {
      const dirPath = path.join(PROJECTS_DIR, dir);
      const jsonlFiles = fs.readdirSync(dirPath).filter((f) => f.endsWith(".jsonl"));

      let lastActive = "";
      for (const file of jsonlFiles) {
        const stat = fs.statSync(path.join(dirPath, file));
        const mtime = new Date(stat.mtimeMs).toISOString();
        if (mtime > lastActive) lastActive = mtime;
      }

      return {
        name: getProjectDisplayName(dir),
        encodedName: dir,
        lastActive,
        sessions: jsonlFiles.length,
      };
    })
    .filter((p) => p.sessions > 0)
    .sort((a, b) => b.lastActive.localeCompare(a.lastActive));
}
