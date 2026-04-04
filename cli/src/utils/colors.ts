const enabled = process.stdout.isTTY !== false && process.env.NO_COLOR === undefined;

const code = (n: number) => enabled ? `\x1b[${n}m` : "";
const reset = code(0);

export const bold = (s: string) => `${code(1)}${s}${reset}`;
export const dim = (s: string) => `${code(2)}${s}${reset}`;
export const green = (s: string) => `${code(32)}${s}${reset}`;
export const yellow = (s: string) => `${code(33)}${s}${reset}`;
export const red = (s: string) => `${code(31)}${s}${reset}`;
export const cyan = (s: string) => `${code(36)}${s}${reset}`;
