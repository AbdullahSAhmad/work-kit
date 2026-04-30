/**
 * Narrow an unknown caught value to a string message.
 * Use when the error needs to be embedded in a user-facing string.
 */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Print the standard `{ "action": "error", "message": ... }` JSON to stderr
 * and exit with code 1. Used by every CLI subcommand's top-level catch.
 */
export function failJson(e: unknown): never {
  const message = errorMessage(e);
  console.error(JSON.stringify({ action: "error", message }));
  process.exit(1);
}
