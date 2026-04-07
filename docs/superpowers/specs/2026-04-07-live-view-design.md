# Live View Page — Design Spec

## Overview

A new "Live View" page in the sidebar that shows real-time project context: memory files, CLAUDE.md editor, and project-level stats. Auto-detects the active project (most recently modified JSONL file), with a fallback project picker when no active session is detected.

## User Flow

1. User clicks "Live View" in sidebar
2. Dashboard checks `~/.claude/projects/` for the most recently modified `.jsonl` file
3. **Active project detected** → drops directly into the project Live View
4. **No active project** → shows a project picker page (list of all projects, click to enter)
5. User can always switch projects via a selector/back button from the Live View

## Page Structure

### Project Header
- Green pulsing dot (active) or grey dot (inactive) indicating session recency
- Project display name (decoded from directory name)
- Project path (monospace, right-aligned)

### Stats Row
Four stat cards in a horizontal row:
- **Total Sessions** — count of JSONL files for this project
- **Total Cost** — sum of all session costs (already computed by `computeProjectStats`)
- **Memory Files** — count of `memory/*.md` files
- **Primary Model** — most-used model across sessions

### Tabbed Content Area
Two tabs with a split-view toggle:

#### Memory Tab (read-only)
- **MEMORY.md index** — parsed list of entries from `MEMORY.md`, showing title and one-line description
- **Individual memory files** — expandable cards for each `memory/*.md` file:
  - Colored badge by type: user (indigo), project (green), feedback (yellow), reference (pink)
  - Name and description from frontmatter
  - Expandable to show full markdown content (rendered as formatted text)

#### CLAUDE.md Tab (read + write)
- Monospace text editor preloaded with the project's `CLAUDE.md` content
- **Save button** — writes changes back to disk via API
- **Reset button** — discards unsaved changes, reloads from disk
- Reads from the project's working directory (resolved from the encoded project path)

#### Split View Toggle
- Button in the tab bar toggles between tabbed mode and two-column side-by-side
- Split view: Memory on left, CLAUDE.md editor on right
- Toggle persists for the session (no need to save preference)

### Project Picker (fallback page)
- Grid/list of all projects from `~/.claude/projects/`
- Each card shows: project name, last active timestamp, session count
- Click to enter that project's Live View
- Shown when no active project is detected, or accessible via back button

## Data Layer

### New API Endpoints

**`GET /api/memory?project=<encoded-project-name>`**
Returns:
```json
{
  "memoryIndex": [
    { "title": "User profile", "file": "user_profile.md", "description": "..." }
  ],
  "memoryFiles": [
    {
      "filename": "user_profile.md",
      "frontmatter": { "name": "...", "description": "...", "type": "user" },
      "content": "..."
    }
  ],
  "claudeMd": "# CLAUDE.md\n...",
  "claudeMdPath": "/absolute/path/to/CLAUDE.md"
}
```

**`PUT /api/memory/claude-md`**
Body: `{ "project": "<encoded-project-name>", "content": "..." }`
Writes the content to the project's CLAUDE.md file on disk. Returns `{ "ok": true }`.

**`GET /api/memory/active-project`**
Scans `~/.claude/projects/` for the most recently modified `.jsonl` file. Returns:
```json
{
  "activeProject": "ListingKit" | null,
  "encodedName": "-Users-lboschi-Desktop-ListingKit",
  "lastActivity": "2026-04-07T15:06:00Z"
}
```

### New Data Parser (`src/lib/memory-data.ts`)
- `parseMemoryIndex(projectDir)` — reads `MEMORY.md`, extracts markdown link entries
- `parseMemoryFile(filePath)` — reads a `.md` file, parses YAML frontmatter (name, description, type) and body content
- `readClaudeMd(projectDir)` — reads `CLAUDE.md` from the project's actual working directory (decode the encoded project path to resolve the real path)
- `writeClaudeMd(projectDir, content)` — writes content back to the resolved CLAUDE.md path
- `detectActiveProject()` — finds most recently modified JSONL across all project dirs

### Resolving CLAUDE.md Path
The `~/.claude/projects/` directory uses encoded names (e.g., `-Users-lboschi-Desktop-ListingKit`). To find CLAUDE.md, decode this back to the actual filesystem path (`/Users/lboschi/Desktop/ListingKit/CLAUDE.md`). The existing `claude-data.ts` already decodes project names — reuse that logic.

## New Files

- `src/app/live/page.tsx` — Live View page (project picker or active view)
- `src/components/live-view.tsx` — main Live View component (tabs, split toggle, layout)
- `src/components/memory-panel.tsx` — memory index + expandable memory files (read-only)
- `src/components/claude-md-editor.tsx` — CLAUDE.md text editor with save/reset
- `src/components/project-picker.tsx` — fallback grid for selecting a project
- `src/lib/memory-data.ts` — memory file parsing and CLAUDE.md read/write
- `src/app/api/memory/route.ts` — GET endpoint for memory data
- `src/app/api/memory/claude-md/route.ts` — PUT endpoint for CLAUDE.md saves
- `src/app/api/memory/active-project/route.ts` — GET endpoint for active project detection

## Modified Files

- `src/components/sidebar.tsx` — add "Live View" nav item

## Auto-Refresh

- Active project detection polls every 30 seconds (reuses existing polling pattern from `use-dashboard-data.ts`)
- Memory content refreshes when navigating to the page or switching projects
- No auto-refresh of CLAUDE.md editor while user is editing (prevent overwriting unsaved changes)

## Edge Cases

- **No memory directory** — show "No memories stored for this project" message
- **No CLAUDE.md** — show empty editor with a note "No CLAUDE.md found — create one?"
- **Empty MEMORY.md** — show index section with "No entries" message
- **Malformed frontmatter** — gracefully degrade, show raw content without badges
- **Active project detection ties** — use the single most recent JSONL modification time
- **Stale "active" project** — if the most recent JSONL was modified more than 10 minutes ago, still show it as the active project but use a grey dot instead of green (indicates no live session)
- **CLAUDE.md save failure** — show error toast, don't clear editor content
