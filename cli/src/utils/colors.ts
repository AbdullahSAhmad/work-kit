const enabled = process.stdout.isTTY !== false && process.env.NO_COLOR === undefined;

const code = (n: number) => (enabled ? `\x1b[${n}m` : "");
const reset = code(0);

export const bold = (s: string) => `${code(1)}${s}${reset}`;
export const dim = (s: string) => `${code(2)}${s}${reset}`;
export const green = (s: string) => `${code(32)}${s}${reset}`;
export const yellow = (s: string) => `${code(33)}${s}${reset}`;
export const red = (s: string) => `${code(31)}${s}${reset}`;
export const cyan = (s: string) => `${code(36)}${s}${reset}`;
export const blue = (s: string) => `${code(34)}${s}${reset}`;
export const magenta = (s: string) => `${code(35)}${s}${reset}`;
export const bgGreen = (s: string) => `${code(42)}${code(30)}${s}${reset}`;
export const bgYellow = (s: string) => `${code(43)}${code(30)}${s}${reset}`;
export const bgCyan = (s: string) => `${code(46)}${code(30)}${s}${reset}`;
export const bgRed = (s: string) => `${code(41)}${code(97)}${s}${reset}`;
export const bgDim = (s: string) => `${code(100)}${code(97)}${s}${reset}`;
export const bgMagenta = (s: string) => `${code(45)}${code(97)}${s}${reset}`;
export const bgBlue = (s: string) => `${code(44)}${code(97)}${s}${reset}`;
export const boldCyan = (s: string) => `${code(1)}${code(36)}${s}${reset}`;
export const boldGreen = (s: string) => `${code(1)}${code(32)}${s}${reset}`;
export const boldYellow = (s: string) => `${code(1)}${code(33)}${s}${reset}`;
export const boldRed = (s: string) => `${code(1)}${code(31)}${s}${reset}`;
export const boldMagenta = (s: string) => `${code(1)}${code(35)}${s}${reset}`;
