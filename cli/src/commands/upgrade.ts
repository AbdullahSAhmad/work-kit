import { setupCommand } from "./setup.js";

export async function upgradeCommand(worktreeRoot?: string): Promise<void> {
  const target = worktreeRoot || process.cwd();
  // setupCommand already handles:
  // - detecting .claude/ in current dir
  // - copying skills (skipping unchanged)
  // - running doctor
  // Just add upgrade-specific messaging
  console.error("Upgrading work-kit skills to latest version...\n");
  await setupCommand(target);
}
