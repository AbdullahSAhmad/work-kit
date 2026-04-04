import { bold, dim, green, yellow, red, cyan, bgYellow } from "../utils/colors.js";
import type { DashboardData, WorkItemView, CompletedItemView } from "./data.js";

// ── Time Formatting ─────────────────────────────────────────────────

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return "unknown";

  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  const weeks = Math.floor(days / 7);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) {
    const remainMin = minutes % 60;
    return remainMin > 0 ? `${hours}h ${remainMin}m ago` : `${hours}h ago`;
  }
  if (days < 7) return `${days}d ago`;
  return `${weeks}w ago`;
}

// ── Box Drawing ─────────────────────────────────────────────────────

function horizontalLine(width: number): string {
  return "═".repeat(Math.max(0, width - 2));
}

function padRight(text: string, width: number): string {
  // Strip ANSI codes for length calculation
  const plainLen = stripAnsi(text).length;
  const padding = Math.max(0, width - plainLen);
  return text + " ".repeat(padding);
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function centerText(text: string, width: number): string {
  const plainLen = stripAnsi(text).length;
  const totalPad = Math.max(0, width - plainLen);
  const leftPad = Math.floor(totalPad / 2);
  const rightPad = totalPad - leftPad;
  return " ".repeat(leftPad) + text + " ".repeat(rightPad);
}

function boxLine(content: string, innerWidth: number): string {
  return `║ ${padRight(content, innerWidth)} ║`;
}

function emptyBoxLine(innerWidth: number): string {
  return `║ ${" ".repeat(innerWidth)} ║`;
}

// ── Progress Bar ────────────────────────────────────────────────────

function renderProgressBar(
  completed: number,
  total: number,
  percent: number,
  label: string,
  maxBarWidth: number
): string {
  const barWidth = Math.max(20, Math.min(40, maxBarWidth));
  const filled = total > 0 ? Math.round((completed / total) * barWidth) : 0;
  const empty = barWidth - filled;

  const filledStr = green("█".repeat(filled));
  const emptyStr = dim("░".repeat(empty));
  const stats = `${label}  ${completed}/${total}  ${percent}%`;

  return `${filledStr}${emptyStr}   ${stats}`;
}

// ── Phase Status Indicators ─────────────────────────────────────────

function phaseIndicator(status: string): string {
  switch (status) {
    case "completed": return green("✓");
    case "in-progress": return cyan("▶");
    case "pending": return dim("·");
    case "skipped": return dim("⊘");
    case "failed": return red("✗");
    default: return dim("·");
  }
}

function statusDot(status: string): string {
  switch (status) {
    case "in-progress": return green("●");
    case "paused": return yellow("○");
    case "completed": return green("✓");
    case "failed": return red("✗");
    default: return dim("·");
  }
}

// ── Render Work Item ────────────────────────────────────────────────

function renderWorkItem(item: WorkItemView, innerWidth: number): string[] {
  const lines: string[] = [];

  const slugText = `${statusDot(item.status)} ${bold(item.slug)}`;
  const branchText = dim(item.branch);
  const slugPlainLen = stripAnsi(slugText).length;
  const branchPlainLen = stripAnsi(branchText).length;
  const gap1 = Math.max(2, innerWidth - slugPlainLen - branchPlainLen);
  lines.push(slugText + " ".repeat(gap1) + branchText);

  const modeText = item.mode + (item.classification ? ` (${item.classification})` : "");
  const pausedBadge = item.status === "paused" ? "  " + bgYellow(" PAUSED ") : "";
  const startedText = dim(`Started: ${formatTimeAgo(item.startedAt)}`);
  const modeStr = `  ${modeText}${pausedBadge}`;
  const modePlainLen = stripAnsi(modeStr).length;
  const startedPlainLen = stripAnsi(startedText).length;
  const gap2 = Math.max(2, innerWidth - modePlainLen - startedPlainLen);
  lines.push(modeStr + " ".repeat(gap2) + startedText);

  const phaseLabel = item.currentPhase
    ? (item.currentSubStage ? `${item.currentPhase}/${item.currentSubStage}` : item.currentPhase)
    : "—";
  const barMaxWidth = Math.max(20, Math.min(40, innerWidth - 30));
  lines.push("  " + renderProgressBar(
    item.progress.completed,
    item.progress.total,
    item.progress.percent,
    phaseLabel,
    barMaxWidth
  ));

  const phaseStrs = item.phases.map(p => `${p.name} ${phaseIndicator(p.status)}`);
  lines.push("  " + phaseStrs.join("  "));

  if (item.loopbacks.count > 0) {
    const lb = item.loopbacks;
    let loopStr = `  ${cyan("⟳")} ${lb.count} loopback${lb.count > 1 ? "s" : ""}`;
    if (lb.lastFrom && lb.lastTo) {
      loopStr += `: ${lb.lastFrom} → ${lb.lastTo}`;
    }
    if (lb.lastReason) {
      loopStr += ` (${lb.lastReason})`;
    }
    lines.push(loopStr);
  }

  return lines;
}

// ── Render Completed Item ───────────────────────────────────────────

function renderCompletedItem(item: CompletedItemView, innerWidth: number): string {
  const check = green("✓");
  const slug = item.slug;
  const pr = item.pr ? `  ${dim(item.pr)}` : "";
  const date = item.completedAt ? `  ${dim(item.completedAt)}` : "";
  const phases = item.phases ? `  ${dim(item.phases)}` : "";
  const content = `${check} ${slug}${pr}${date}${phases}`;
  return content;
}

// ── Main Render Function ────────────────────────────────────────────

export function renderDashboard(
  data: DashboardData,
  width: number,
  height: number,
  scrollOffset: number = 0
): string {
  const maxWidth = Math.min(width, 120);
  const innerWidth = maxWidth - 4; // account for "║ " and " ║"

  const allLines: string[] = [];

  // Top border
  allLines.push(`╔${horizontalLine(maxWidth)}╗`);

  let activeCount = 0, pausedCount = 0, failedCount = 0;
  for (const item of data.activeItems) {
    if (item.status === "in-progress") activeCount++;
    else if (item.status === "paused") pausedCount++;
    else if (item.status === "failed") failedCount++;
  }

  let headerRight = "";
  if (activeCount > 0) headerRight += `${green("●")} ${activeCount} active`;
  if (pausedCount > 0) headerRight += `  ${yellow("○")} ${pausedCount} paused`;
  if (failedCount > 0) headerRight += `  ${red("✗")} ${failedCount} failed`;

  const headerLeft = bold("  WORK-KIT OBSERVER");
  const headerLeftLen = stripAnsi(headerLeft).length;
  const headerRightLen = stripAnsi(headerRight).length;
  const headerGap = Math.max(2, innerWidth - headerLeftLen - headerRightLen);
  allLines.push(boxLine(headerLeft + " ".repeat(headerGap) + headerRight, innerWidth));

  // Separator
  allLines.push(`╠${horizontalLine(maxWidth)}╣`);

  if (data.activeItems.length === 0 && data.completedItems.length === 0) {
    // Empty state
    allLines.push(emptyBoxLine(innerWidth));
    allLines.push(boxLine(dim("  No active work items found."), innerWidth));
    allLines.push(boxLine(dim("  Start a new work item with: work-kit init"), innerWidth));
    allLines.push(emptyBoxLine(innerWidth));
  } else {
    // Active items
    if (data.activeItems.length > 0) {
      allLines.push(emptyBoxLine(innerWidth));

      for (let i = 0; i < data.activeItems.length; i++) {
        const item = data.activeItems[i];
        const itemLines = renderWorkItem(item, innerWidth);
        for (const line of itemLines) {
          allLines.push(boxLine(line, innerWidth));
        }
        if (i < data.activeItems.length - 1) {
          allLines.push(emptyBoxLine(innerWidth));
        }
      }

      allLines.push(emptyBoxLine(innerWidth));
    }

    // Completed section
    if (data.completedItems.length > 0) {
      allLines.push(`╠${horizontalLine(maxWidth)}╣`);
      allLines.push(boxLine(bold("  COMPLETED"), innerWidth));

      const maxCompleted = 5;
      const displayed = data.completedItems.slice(0, maxCompleted);
      for (const item of displayed) {
        const content = renderCompletedItem(item, innerWidth);
        allLines.push(boxLine("  " + content, innerWidth));
      }
      if (data.completedItems.length > maxCompleted) {
        allLines.push(boxLine(
          dim(`  ... and ${data.completedItems.length - maxCompleted} more`),
          innerWidth
        ));
      }
    }
  }

  // Footer separator
  allLines.push(`╠${horizontalLine(maxWidth)}╣`);

  // Footer
  const footerLeft = `  ${dim("q")} quit  ${dim("↑↓")} scroll  ${dim("r")} refresh`;
  const timeStr = data.lastUpdated.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const footerRight = dim(`Updated: ${timeStr}`);
  const footerLeftLen = stripAnsi(footerLeft).length;
  const footerRightLen = stripAnsi(footerRight).length;
  const footerGap = Math.max(2, innerWidth - footerLeftLen - footerRightLen);
  allLines.push(boxLine(footerLeft + " ".repeat(footerGap) + footerRight, innerWidth));

  // Bottom border
  allLines.push(`╚${horizontalLine(maxWidth)}╝`);

  // Apply scrolling: figure out how many content lines we have vs available height
  const totalLines = allLines.length;
  const availableHeight = height;

  if (totalLines <= availableHeight) {
    // Everything fits, no scrolling needed
    return allLines.join("\n") + "\n";
  }

  // Apply scroll offset
  const maxScroll = Math.max(0, totalLines - availableHeight);
  const clampedOffset = Math.min(scrollOffset, maxScroll);
  const visibleLines = allLines.slice(clampedOffset, clampedOffset + availableHeight);

  // Add scroll indicator if not showing everything
  if (clampedOffset > 0 || clampedOffset + availableHeight < totalLines) {
    const scrollPct = Math.round((clampedOffset / maxScroll) * 100);
    const indicator = dim(` [${scrollPct}% scrolled]`);
    if (visibleLines.length > 0) {
      visibleLines[visibleLines.length - 1] = visibleLines[visibleLines.length - 1] + indicator;
    }
  }

  return visibleLines.join("\n") + "\n";
}

// ── Terminal Control ────────────────────────────────────────────────

export function enterAlternateScreen(): void {
  process.stdout.write("\x1b[?1049h"); // enter alternate screen
  process.stdout.write("\x1b[?25l");   // hide cursor
}

export function exitAlternateScreen(): void {
  process.stdout.write("\x1b[?25h");   // show cursor
  process.stdout.write("\x1b[?1049l"); // exit alternate screen
}

export function clearAndHome(): string {
  return "\x1b[H\x1b[2J"; // move to top-left + clear screen
}

export function moveCursorHome(): string {
  return "\x1b[H";
}

export function renderTooSmall(width: number, height: number): string {
  const msg = `Terminal too small (${width}x${height}). Need at least 60x10.`;
  return clearAndHome() + msg + "\n";
}
