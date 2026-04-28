import * as path from "node:path";
import {
  PHASE_NAMES,
  STEPS_BY_PHASE,
  isClassification,
  type PhaseName,
  type Classification,
} from "../state/schema.js";
import { readJsonFile } from "../utils/json.js";
import { PROJECT_CONFIG_FILE } from "./constants.js";

/**
 * Optional `.work-kit-config.json` lives at the main repo root.
 *
 * Example:
 *   {
 *     "defaults": { "mode": "auto", "classification": "feature", "gated": false },
 *     "workflow": {
 *       "include": ["wrap-up/knowledge"],
 *       "exclude": ["deploy/monitor"]
 *     }
 *   }
 *
 * Note: Review's parallel reviewer fan-out (Quality / Efficiency / Security /
 * Compliance) happens *inside* the review/review step via the Agent tool. It's
 * not a framework parallel group, so `parallel.review` is no longer applicable.
 * Test follows the same pattern (test/exercise fans out internally).
 */
export interface ProjectParallelGroup {
  parallel: string[];
  thenSequential?: string;
}

export interface ProjectConfig {
  defaults?: {
    mode?: "full" | "auto";
    classification?: Classification;
    gated?: boolean;
  };
  /** Override or extend the per-phase parallel groups. */
  parallel?: Partial<Record<PhaseName, ProjectParallelGroup>>;
  /** Force-include or force-exclude specific steps (phase/step). */
  workflow?: {
    include?: string[];
    exclude?: string[];
  };
}

const EMPTY_CONFIG: ProjectConfig = {};

/** Load and validate the project config. Returns empty config when missing/invalid. */
export function loadProjectConfig(mainRepoRoot: string): ProjectConfig {
  const parsed = readJsonFile<unknown>(path.join(mainRepoRoot, PROJECT_CONFIG_FILE));
  if (!parsed) return EMPTY_CONFIG;
  return validateConfig(parsed);
}

function validateConfig(raw: any): ProjectConfig {
  const out: ProjectConfig = {};

  if (raw && typeof raw === "object") {
    if (raw.defaults && typeof raw.defaults === "object") {
      const d = raw.defaults;
      out.defaults = {};
      if (d.mode === "full" || d.mode === "auto") out.defaults.mode = d.mode;
      if (typeof d.classification === "string" && isClassification(d.classification)) {
        out.defaults.classification = d.classification;
      }
      if (typeof d.gated === "boolean") out.defaults.gated = d.gated;
    }

    if (raw.parallel && typeof raw.parallel === "object") {
      out.parallel = {};
      for (const [phase, group] of Object.entries(raw.parallel)) {
        if (!(PHASE_NAMES as readonly string[]).includes(phase)) continue;
        const g = group as any;
        if (!g || !Array.isArray(g.parallel)) continue;
        const validSteps = STEPS_BY_PHASE[phase as PhaseName];
        const parallel = g.parallel.filter((s: any) => typeof s === "string" && validSteps.includes(s));
        if (parallel.length === 0) continue;
        const entry: ProjectParallelGroup = { parallel };
        if (typeof g.thenSequential === "string" && validSteps.includes(g.thenSequential)) {
          entry.thenSequential = g.thenSequential;
        }
        out.parallel[phase as PhaseName] = entry;
      }
    }

    if (raw.workflow && typeof raw.workflow === "object") {
      out.workflow = {};
      for (const key of ["include", "exclude"] as const) {
        if (Array.isArray(raw.workflow[key])) {
          out.workflow[key] = raw.workflow[key].filter((s: any) => isValidStepRef(s));
        }
      }
    }
  }

  return out;
}

function isValidStepRef(ref: any): boolean {
  if (typeof ref !== "string") return false;
  const [phase, step] = ref.split("/");
  if (!phase || !step) return false;
  if (!(PHASE_NAMES as readonly string[]).includes(phase)) return false;
  return STEPS_BY_PHASE[phase as PhaseName].includes(step);
}
