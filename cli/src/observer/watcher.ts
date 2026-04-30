import * as fs from "node:fs";
import * as path from "node:path";
import { discoverWorktrees, type WorktreeEntry } from "./data.js";

export interface WatcherHandle {
  stop: () => void;
  getWorktrees: () => WorktreeEntry[];
}

export function startWatching(mainRepoRoots: string[], onUpdate: () => void): WatcherHandle {
  const watchers = new Map<string, fs.FSWatcher>();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;
  let cachedEntries: WorktreeEntry[] = [];

  function debouncedUpdate(): void {
    if (stopped) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!stopped) onUpdate();
    }, 50);
  }

  function watchStateFile(worktreeRoot: string): void {
    if (watchers.has(worktreeRoot)) return;
    const stateDir = path.join(worktreeRoot, ".work-kit");
    if (!fs.existsSync(stateDir)) return;

    try {
      // Watch the directory, not the file — writeState uses atomic
      // rename (write tmp + rename), which replaces the inode and
      // breaks fs.watch on the file on Linux.
      const watcher = fs.watch(stateDir, { persistent: false }, (_event, filename) => {
        if (filename === "tracker.json") {
          debouncedUpdate();
        }
      });
      watcher.on("error", () => {
        watcher.close();
        watchers.delete(worktreeRoot);
      });
      watchers.set(worktreeRoot, watcher);
    } catch {
      // Directory might not exist yet
    }
  }

  function unwatchRemoved(currentSet: Set<string>): void {
    for (const [wt, watcher] of watchers) {
      if (!currentSet.has(wt)) {
        watcher.close();
        watchers.delete(wt);
      }
    }
  }

  function refreshWorktrees(): void {
    if (stopped) return;
    const seen = new Set<string>();
    const current: WorktreeEntry[] = [];
    for (const root of mainRepoRoots) {
      for (const wt of discoverWorktrees(root)) {
        if (seen.has(wt)) continue;
        seen.add(wt);
        current.push({ root, worktree: wt });
      }
    }

    // Only trigger update if the entry list actually changed. Compare
    // both fields so a worktree path reused under a different root is
    // detected as a real change.
    const changed =
      current.length !== cachedEntries.length ||
      current.some((e, i) => e.worktree !== cachedEntries[i].worktree || e.root !== cachedEntries[i].root);

    for (const e of current) {
      watchStateFile(e.worktree);
    }
    unwatchRemoved(seen);

    cachedEntries = current;

    if (changed) {
      debouncedUpdate();
    }
  }

  // Initial setup
  refreshWorktrees();

  // Poll for new/removed worktrees. Each tick spawns one `git worktree
  // list` per root, so back off when watching many repos under --all.
  const pollIntervalMs = mainRepoRoots.length > 1 ? 30_000 : 5_000;
  pollTimer = setInterval(() => {
    if (!stopped) refreshWorktrees();
  }, pollIntervalMs);

  return {
    stop() {
      stopped = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (pollTimer) clearInterval(pollTimer);
      for (const watcher of watchers.values()) {
        watcher.close();
      }
      watchers.clear();
    },
    getWorktrees() {
      return cachedEntries;
    },
  };
}
