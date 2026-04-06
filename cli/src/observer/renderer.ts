import {
  bold, dim, green, yellow, red, cyan, magenta,
  bgYellow, bgCyan, bgRed, bgMagenta, bgGreen, bgBlue,
  boldCyan, boldGreen,
} from "../utils/colors.js";
import { formatDurationMs, formatDurationSince } from "../utils/time.js";
import { MODE_FULL } from "../state/schema.js";
import type { DashboardData, WorkItemView, CompletedItemView } from "./data.js";

// ── Spinners & Animation Frames ─────────────────────────────────────

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const PULSE = ["◐", "◓", "◑", "◒"];

function spinner(tick: number): string {
  return cyan(SPINNER[tick % SPINNER.length]);
}

function pulse(tick: number): string {
  return PULSE[tick % PULSE.length];
}

// ── Mascot ──────────────────────────────────────────────────────────

function mascot(tick: number, hasActive: boolean): string {
  if (!hasActive) {
    // Idle — sleeping wrench
    const faces = ["⚙ zzZ", "⚙  zZ", "⚙   z"];
    return dim(faces[tick % faces.length]);
  }
  // Working — animated gear
  const gears = ["⚙", "⚙", "⚙", "⚙"];
  const sparks = ["·", "✦", "·", "✧"];
  return cyan(gears[tick % gears.length]) + yellow(sparks[tick % sparks.length]);
}

// ── Time Formatting ─────────────────────────────────────────────────

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return "unknown";

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  const weeks = Math.floor(days / 7);

  if (isDateOnly) {
    if (days < 1) return "today";
    if (days === 1) return "yesterday";
    if (days < 7) return `${days}d ago`;
    return `${weeks}w ago`;
  }

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) {
    const remainMin = minutes % 60;
    return remainMin > 0 ? `${hours}h ${remainMin}m ago` : `${hours}h ago`;
  }
  if (days < 7) return `${days}d ago`;
  return `${weeks}w ago`;
}

const formatDuration = formatDurationSince;

// ── Box Drawing ─────────────────────────────────────────────────────

function horizontalLine(width: number): string {
  return "═".repeat(Math.max(0, width - 2));
}

function thinLine(width: number): string {
  return "─".repeat(Math.max(0, width));
}

function padRight(text: string, width: number): string {
  const plainLen = stripAnsi(text).length;
  const padding = Math.max(0, width - plainLen);
  return text + " ".repeat(padding);
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function boxLine(content: string, innerWidth: number): string {
  return `║ ${padRight(content, innerWidth)} ║`;
}

function emptyBoxLine(innerWidth: number): string {
  return `║ ${" ".repeat(innerWidth)} ║`;
}

// ── Progress Bar ────────────────────────────────────────────────────

function progressColor(percent: number): (s: string) => string {
  if (percent >= 75) return green;
  if (percent >= 50) return cyan;
  if (percent >= 25) return yellow;
  return red;
}

function renderProgressBar(
  completed: number,
  total: number,
  percent: number,
  maxBarWidth: number,
  tick: number
): string {
  const barWidth = Math.max(20, Math.min(40, maxBarWidth));
  const filled = total > 0 ? Math.round((completed / total) * barWidth) : 0;
  const empty = barWidth - filled;

  const colorFn = progressColor(percent);

  // Animated head on the progress bar
  let filledStr: string;
  if (filled > 0 && filled < barWidth) {
    const body = colorFn("█".repeat(filled - 1));
    const head = tick % 2 === 0 ? colorFn("▓") : colorFn("█");
    filledStr = body + head;
  } else {
    filledStr = colorFn("█".repeat(filled));
  }

  const emptyStr = dim("░".repeat(empty));
  const stats = dim(`${completed}/${total}`) + "  " + colorFn(`${percent}%`);

  return `${filledStr}${emptyStr}  ${stats}`;
}

// ── Phase Status Indicators ─────────────────────────────────────────

function phaseIndicator(status: string, tick: number = 0): string {
  switch (status) {
    case "completed": return green("✓");
    case "in-progress": return spinner(tick);
    case "waiting": return tick % 2 === 0 ? yellow("◉") : dim("◉");
    case "pending": return dim("·");
    case "skipped": return dim("⊘");
    case "failed": return red("✗");
    default: return dim("·");
  }
}

function stepIndicator(status: string, tick: number): string {
  switch (status) {
    case "completed": return green("●");
    case "in-progress": return cyan(pulse(tick));
    case "waiting": return yellow("○");
    case "pending": return dim("○");
    case "skipped": return dim("⊘");
    case "failed": return red("●");
    default: return dim("○");
  }
}

function phaseName(name: string, status: string, tick: number): string {
  switch (status) {
    case "completed": return boldGreen(name);
    case "in-progress": return tick % 2 === 0 ? boldCyan(name) : bold(cyan(name));
    case "waiting": return bold(yellow(name));
    case "failed": return bold(red(name));
    default: return dim(name);
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

// ── Badges ──────────────────────────────────────────────────────────

function renderModeBadge(mode: string): string {
  return mode === MODE_FULL ? bgCyan(" Full Kit ") : bgYellow(" Auto Kit ");
}

function renderGatedBadge(): string {
  return bgMagenta(" GATED ");
}

function renderClassificationBadge(classification: string): string {
  const label = ` ${classification.toUpperCase()} `;
  switch (classification) {
    case "bug-fix": return bgRed(label);
    case "small-change": return bgGreen(label);
    case "refactor": return bgCyan(label);
    case "feature": return bgBlue(label);
    case "large-feature": return bgMagenta(label);
    default: return bgYellow(label);
  }
}

// ── Phase Pipeline ──────────────────────────────────────────────────

function phaseDuration(p: { status: string; startedAt?: string; completedAt?: string }): string {
  if (p.status === "completed" && p.startedAt && p.completedAt) {
    const ms = new Date(p.completedAt).getTime() - new Date(p.startedAt).getTime();
    return formatDurationMs(ms);
  }
  if ((p.status === "in-progress" || p.status === "waiting") && p.startedAt) {
    return formatDuration(p.startedAt);
  }
  return "";
}

function renderPhasePipeline(
  phases: WorkItemView["phases"],
  tick: number
): string[] {
  const connector = dim(" ── ");
  const connectorLen = 4; // " ── "

  // Build top line (icons + names) and bottom line (timing, aligned)
  const topParts: string[] = [];
  const bottomParts: string[] = [];

  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    const icon = phaseIndicator(p.status, tick);
    const name = phaseName(p.name, p.status, tick);
    const segment = `${icon} ${name}`;
    topParts.push(segment);

    // Calculate plain width of this segment for alignment
    const segPlainLen = stripAnsi(segment).length;
    const dur = phaseDuration(p);

    if (dur) {
      // Color the duration based on status
      let durStyled: string;
      if (p.status === "completed") durStyled = dim(dur);
      else if (p.status === "in-progress") durStyled = cyan(dur);
      else if (p.status === "waiting") durStyled = yellow(dur);
      else durStyled = dim(dur);

      // Center the duration under the segment
      const durPlainLen = stripAnsi(durStyled).length;
      const pad = Math.max(0, Math.floor((segPlainLen - durPlainLen) / 2));
      bottomParts.push(" ".repeat(pad) + durStyled + " ".repeat(Math.max(0, segPlainLen - durPlainLen - pad)));
    } else {
      bottomParts.push(" ".repeat(segPlainLen));
    }

    // Add connector spacing to bottom line too
    if (i < phases.length - 1) {
      bottomParts.push(" ".repeat(connectorLen));
    }
  }

  const topLine = topParts.join(connector);
  const bottomLine = bottomParts.join("");

  // Only show bottom line if there's at least one duration
  const hasAnyDuration = phases.some(p => phaseDuration(p) !== "");
  if (hasAnyDuration) {
    return [topLine, bottomLine];
  }
  return [topLine];
}

// ── Step Detail Box ─────────────────────────────────────────────────

function renderStepBox(
  item: WorkItemView,
  innerWidth: number,
  tick: number
): string[] {
  const subs = item.phaseSteps;
  if (!subs || subs.length === 0 || !item.currentPhase) return [];

  const lines: string[] = [];
  const label = dim(item.currentPhase);
  const boxInner = innerWidth - 8; // indent + border padding

  // Top border with phase label
  const labelLen = stripAnsi(label).length;
  const topRule = dim("┌─ ") + label + dim(" " + "─".repeat(Math.max(0, boxInner - labelLen - 2)) + "┐");
  lines.push("  " + topRule);

  // Render steps in rows that fit the width
  const entries: string[] = [];
  for (const ss of subs) {
    const icon = stepIndicator(ss.status, tick);
    let nameStr: string;
    switch (ss.status) {
      case "completed": nameStr = green(ss.name); break;
      case "in-progress": nameStr = boldCyan(ss.name); break;
      case "waiting": nameStr = yellow(ss.name); break;
      case "failed": nameStr = red(ss.name); break;
      default: nameStr = dim(ss.name);
    }
    let duration = "";
    if (ss.status === "completed" && ss.startedAt && ss.completedAt) {
      const ms = new Date(ss.completedAt).getTime() - new Date(ss.startedAt).getTime();
      duration = dim(` ${formatDurationMs(ms)}`);
    } else if (ss.status === "in-progress" && ss.startedAt) {
      duration = dim(` ${formatDuration(ss.startedAt)}`);
    }
    entries.push(`${icon} ${nameStr}${duration}`);
  }

  // Flow entries into rows
  let currentRow = "";
  let currentRowLen = 0;
  for (const entry of entries) {
    const entryLen = stripAnsi(entry).length;
    const separator = currentRowLen > 0 ? "  " : "";
    const sepLen = currentRowLen > 0 ? 2 : 0;

    if (currentRowLen + sepLen + entryLen > boxInner && currentRowLen > 0) {
      // Wrap to new row
      const padded = padRight(currentRow, boxInner);
      lines.push("  " + dim("│ ") + padded + dim(" │"));
      currentRow = entry;
      currentRowLen = entryLen;
    } else {
      currentRow += separator + entry;
      currentRowLen += sepLen + entryLen;
    }
  }
  // Last row
  if (currentRowLen > 0) {
    const padded = padRight(currentRow, boxInner);
    lines.push("  " + dim("│ ") + padded + dim(" │"));
  }

  // Bottom border
  lines.push("  " + dim("└" + "─".repeat(boxInner + 2) + "┘"));

  return lines;
}

// ── Render Work Item ────────────────────────────────────────────────

function renderWorkItem(item: WorkItemView, innerWidth: number, tick: number): string[] {
  const lines: string[] = [];

  // Line 1: status dot + bold slug + elapsed time (right)
  const slugText = `${statusDot(item.status)} ${bold(item.slug)}`;
  const elapsed = formatTimeAgo(item.startedAt);
  const elapsedText = dim(`⏱ ${elapsed}`);
  const slugLen = stripAnsi(slugText).length;
  const elapsedLen = stripAnsi(elapsedText).length;
  const gap1 = Math.max(2, innerWidth - slugLen - elapsedLen);
  lines.push(slugText + " ".repeat(gap1) + elapsedText);

  // Line 2: branch + mode badge + gated badge + classification
  const branchText = dim("⎇ " + item.branch);
  let badges = "  " + renderModeBadge(item.mode);
  if (item.gated) badges += " " + renderGatedBadge();
  if (item.status === "paused") badges += " " + bgYellow(" PAUSED ");
  if (item.status === "failed") badges += " " + bgRed(" FAILED ");
  if (item.classification) badges += " " + renderClassificationBadge(item.classification);
  lines.push("  " + branchText + badges);

  // Line 3: timing — phase elapsed + step elapsed
  const timingParts: string[] = [];
  if (item.currentPhase && item.currentPhaseStartedAt) {
    timingParts.push(cyan("phase") + dim(`: ${formatDuration(item.currentPhaseStartedAt)}`));
  }
  if (item.currentStep && item.currentStepStartedAt) {
    timingParts.push(cyan("step") + dim(`: ${formatDuration(item.currentStepStartedAt)}`));
  }
  if (timingParts.length > 0) {
    lines.push("  " + timingParts.join(dim("  │  ")));
  }

  // Line 4: progress bar with animated head
  const barMaxWidth = Math.max(20, Math.min(40, innerWidth - 20));
  lines.push("  " + renderProgressBar(
    item.progress.completed,
    item.progress.total,
    item.progress.percent,
    barMaxWidth,
    tick
  ));

  // Line 5-6: phase pipeline with connectors, spinner, and timing row
  const pipelineLines = renderPhasePipeline(item.phases, tick);
  for (const pl of pipelineLines) {
    lines.push("  " + pl);
  }

  // Step detail box (all steps of current phase)
  const stepBox = renderStepBox(item, innerWidth, tick);
  if (stepBox.length > 0) {
    for (const line of stepBox) {
      lines.push(line);
    }
  }

  // Loopbacks
  if (item.loopbacks.count > 0) {
    const lb = item.loopbacks;
    let loopStr = `  ${yellow("⟳")} ${lb.count} loopback${lb.count > 1 ? "s" : ""}`;
    if (lb.lastFrom && lb.lastTo) {
      loopStr += dim(`: ${lb.lastFrom} → ${lb.lastTo}`);
    }
    if (lb.lastReason) {
      loopStr += dim(` (${lb.lastReason})`);
    }
    lines.push(loopStr);
  }

  // Worktree path
  if (item.worktreePath) {
    let displayPath = item.worktreePath;
    const maxPathLen = innerWidth - 8;
    if (displayPath.length > maxPathLen) {
      displayPath = "…" + displayPath.slice(displayPath.length - maxPathLen + 1);
    }
    lines.push("  " + dim("⌂ " + displayPath));
  }

  return lines;
}

// ── Render Completed Item ───────────────────────────────────────────

interface CompletedColumnWidths {
  slug: number;
  pr: number;
  date: number;
}

function computeCompletedWidths(items: CompletedItemView[]): CompletedColumnWidths {
  let slug = 4, pr = 2, date = 4;
  for (const item of items) {
    slug = Math.max(slug, item.slug.length);
    pr = Math.max(pr, (item.pr || "—").length);
    date = Math.max(date, (item.completedAt || "").length);
  }
  return { slug, pr, date };
}

function renderCompletedItem(item: CompletedItemView, cols: CompletedColumnWidths): string {
  const check = green("✓");
  const slug = padRight(item.slug, cols.slug);
  const pr = padRight(dim(item.pr || "—"), cols.pr);
  const date = padRight(dim(item.completedAt || ""), cols.date);
  const phases = item.phases ? dim(item.phases) : "";
  return `${check} ${slug}  ${pr}  ${date}  ${phases}`;
}

// ── Main Render Function ────────────────────────────────────────────

export function renderDashboard(
  data: DashboardData,
  width: number,
  height: number,
  scrollOffset: number = 0,
  tick: number = 0
): string {
  const maxWidth = Math.min(width, 120);
  const innerWidth = maxWidth - 4;

  const allLines: string[] = [];

  // Top border
  allLines.push(`╔${horizontalLine(maxWidth)}╗`);

  // Header counts
  let activeCount = 0, pausedCount = 0, failedCount = 0, waitingCount = 0;
  for (const item of data.activeItems) {
    if (item.status === "in-progress") activeCount++;
    else if (item.status === "paused") pausedCount++;
    else if (item.status === "failed") failedCount++;
    if (item.currentStepStatus === "waiting") waitingCount++;
  }
  const completedCount = data.completedItems.length;
  const hasActive = activeCount > 0;

  // Header: mascot + title + counts
  let headerRight = "";
  if (activeCount > 0) headerRight += `${green("●")} ${activeCount} active`;
  if (waitingCount > 0) headerRight += `  ${yellow("◉")} ${waitingCount} waiting`;
  if (pausedCount > 0) headerRight += `  ${yellow("○")} ${pausedCount} paused`;
  if (failedCount > 0) headerRight += `  ${red("✗")} ${failedCount} failed`;
  if (completedCount > 0) headerRight += `  ${green("✓")} ${completedCount} done`;

  const mascotStr = mascot(tick, hasActive);
  const headerLeft = `  ${mascotStr} ${bold("WORK-KIT OBSERVER")}`;
  const headerLeftLen = stripAnsi(headerLeft).length;
  const headerRightLen = stripAnsi(headerRight).length;
  const headerGap = Math.max(2, innerWidth - headerLeftLen - headerRightLen);
  allLines.push(boxLine(headerLeft + " ".repeat(headerGap) + headerRight, innerWidth));

  // Separator
  allLines.push(`╠${horizontalLine(maxWidth)}╣`);

  if (data.activeItems.length === 0 && data.completedItems.length === 0) {
    // Empty state with idle mascot
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
        const itemLines = renderWorkItem(item, innerWidth, tick);
        for (const line of itemLines) {
          allLines.push(boxLine(line, innerWidth));
        }
        if (i < data.activeItems.length - 1) {
          allLines.push(emptyBoxLine(innerWidth));
          allLines.push(boxLine(dim("  " + thinLine(innerWidth - 4)), innerWidth));
          allLines.push(emptyBoxLine(innerWidth));
        }
      }

      allLines.push(emptyBoxLine(innerWidth));
    }

    // Completed section
    if (data.completedItems.length > 0) {
      allLines.push(`╠${horizontalLine(maxWidth)}╣`);
      allLines.push(boxLine(
        bold("  COMPLETED") + dim(` (${data.completedItems.length})`),
        innerWidth
      ));

      const maxCompleted = 5;
      const displayed = data.completedItems.slice(0, maxCompleted);
      const cols = computeCompletedWidths(displayed);
      for (const item of displayed) {
        const content = renderCompletedItem(item, cols);
        allLines.push(boxLine("  " + content, innerWidth));
      }
      if (data.completedItems.length > maxCompleted) {
        allLines.push(boxLine(
          dim(`  … and ${data.completedItems.length - maxCompleted} more`),
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
    second: "2-digit",
    hour12: false,
  });
  const footerRight = dim(`Updated: ${timeStr}`);
  const footerLeftLen = stripAnsi(footerLeft).length;
  const footerRightLen = stripAnsi(footerRight).length;
  const footerGap = Math.max(2, innerWidth - footerLeftLen - footerRightLen);
  allLines.push(boxLine(footerLeft + " ".repeat(footerGap) + footerRight, innerWidth));

  // Bottom border
  allLines.push(`╚${horizontalLine(maxWidth)}╝`);

  // Scrolling
  const totalLines = allLines.length;
  const availableHeight = height;

  if (totalLines <= availableHeight) {
    return allLines.join("\n") + "\n\x1b[J";
  }

  const maxScroll = Math.max(0, totalLines - availableHeight);
  const clampedOffset = Math.min(scrollOffset, maxScroll);
  const visibleLines = allLines.slice(clampedOffset, clampedOffset + availableHeight);

  if (clampedOffset > 0 || clampedOffset + availableHeight < totalLines) {
    const scrollPct = Math.round((clampedOffset / maxScroll) * 100);
    const indicator = dim(` [${scrollPct}% scrolled]`);
    if (visibleLines.length > 0) {
      visibleLines[visibleLines.length - 1] = visibleLines[visibleLines.length - 1] + indicator;
    }
  }

  return visibleLines.join("\n") + "\n\x1b[J";
}

// ── Terminal Control ────────────────────────────────────────────────

export function enterAlternateScreen(): void {
  process.stdout.write("\x1b[?1049h");
  process.stdout.write("\x1b[?25l");
}

export function exitAlternateScreen(): void {
  process.stdout.write("\x1b[?25h");
  process.stdout.write("\x1b[?1049l");
}

export function clearAndHome(): string {
  return "\x1b[H\x1b[2J";
}

export function moveCursorHome(): string {
  return "\x1b[H";
}

export function renderTooSmall(width: number, height: number): string {
  const msg = `Terminal too small (${width}x${height}). Need at least 60x10.`;
  return clearAndHome() + msg + "\n";
}
