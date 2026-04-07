import * as path from "node:path";
import {
  renderDashboard,
  enterAlternateScreen,
  exitAlternateScreen,
  moveCursorHome,
  renderTooSmall,
} from "../observer/renderer.js";
import { collectDashboardData, discoverWorkKitProjects } from "../observer/data.js";
import { startWatching } from "../observer/watcher.js";
import { gitMainRepoRoot } from "../state/store.js";

export async function observeCommand(opts: { mainRepo?: string; all?: boolean }): Promise<void> {
  const cwdRoot = () => gitMainRepoRoot(process.cwd()) ?? process.cwd();

  let mainRepoRoots: string[];
  if (opts.all) {
    mainRepoRoots = discoverWorkKitProjects();
    if (mainRepoRoots.length === 0) {
      // Fallback to current repo so the dashboard still has something to show
      mainRepoRoots = [cwdRoot()];
    }
  } else {
    mainRepoRoots = [opts.mainRepo ? path.resolve(opts.mainRepo) : cwdRoot()];
  }

  let scrollOffset = 0;
  let tick = 0;
  let tickInterval: ReturnType<typeof setInterval> | null = null;
  let cleanedUp = false;

  function cleanup(): void {
    if (cleanedUp) return;
    cleanedUp = true;

    // Stop tick interval
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }

    // Restore terminal
    exitAlternateScreen();
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      try { process.stdin.setRawMode(false); } catch { /* ignore */ }
    }
    process.stdin.removeAllListeners("data");
  }

  function render(): void {
    const width = process.stdout.columns || 80;
    const height = process.stdout.rows || 24;

    if (width < 60 || height < 10) {
      process.stdout.write(renderTooSmall(width, height));
      return;
    }

    const data = collectDashboardData(mainRepoRoots, watcher.getWorktrees());
    const frame = moveCursorHome() + renderDashboard(data, width, height, scrollOffset, tick);
    process.stdout.write(frame);
  }

  // Enter alternate screen
  enterAlternateScreen();

  // Set up signal handlers
  const onSignal = () => {
    cleanup();
    process.exit(0);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  let watcher!: ReturnType<typeof startWatching>;

  try {
    // Set up file watching (before initial render so worktrees are cached)
    watcher = startWatching(mainRepoRoots, () => {
      render();
    });

    // Initial render
    render();

    // Tick interval for flashing active stage indicator
    tickInterval = setInterval(() => {
      tick++;
      render();
    }, 500);

    // Handle terminal resize
    process.stdout.on("resize", () => {
      render();
    });

    // Set up keyboard input
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf-8");

      await new Promise<void>((resolve) => {
        process.stdin.on("data", (key: string) => {
          // Ctrl+C
          if (key === "\x03") {
            watcher.stop();
            resolve();
            return;
          }

          // 'q' to quit
          if (key === "q" || key === "Q") {
            watcher.stop();
            resolve();
            return;
          }

          // 'r' to refresh
          if (key === "r" || key === "R") {
            scrollOffset = 0;
            render();
            return;
          }

          // Up arrow: \x1b[A
          if (key === "\x1b[A") {
            scrollOffset = Math.max(0, scrollOffset - 1);
            render();
            return;
          }

          // Down arrow: \x1b[B
          if (key === "\x1b[B") {
            scrollOffset++;
            render();
            return;
          }
        });
      });
    } else {
      // Non-TTY: just keep running until interrupted
      await new Promise<void>((resolve) => {
        process.on("SIGINT", () => {
          watcher.stop();
          resolve();
        });
      });
    }
  } finally {
    cleanup();
  }
}
