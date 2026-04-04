import * as fs from "node:fs";
import * as path from "node:path";
import { discoverWorktrees } from "./data.js";

export interface WatcherHandle {
  stop: () => void;
  getWorktrees: () => string[];
}

export function startWatching(
  mainRepoRoot: string,
  onUpdate: () => void
): WatcherHandle {
  const watchers = new Map<string, fs.FSWatcher>();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;
  let cachedWorktrees: string[] = [];

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
        if (filename === "state.json") {
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
    const current = discoverWorktrees(mainRepoRoot);
    const currentSet = new Set(current);

    // Only trigger update if worktree list actually changed
    const changed = current.length !== cachedWorktrees.length
      || current.some((wt, i) => wt !== cachedWorktrees[i]);

    for (const wt of current) {
      watchStateFile(wt);
    }
    unwatchRemoved(currentSet);

    cachedWorktrees = current;

    if (changed) {
      debouncedUpdate();
    }
  }

  // Initial setup
  refreshWorktrees();

  // Poll for new/removed worktrees every 5 seconds
  pollTimer = setInterval(() => {
    if (!stopped) refreshWorktrees();
  }, 5000);

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
      return cachedWorktrees;
    },
  };
}
