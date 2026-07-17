// ==========================================
// Deepcode TUI v2 - Modern Terminal Interface
// ==========================================

import * as readline from "readline";
import { EventEmitter } from "events";

// ==========================================
// ANSI Helpers
// ==========================================

export const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",

  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",

  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",
};

export const cstrip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

// ==========================================
// Terminal Control
// ==========================================

export function clear() {
  process.stdout.write("\x1b[2J\x1b[H");
}

export function hideCursor() {
  process.stdout.write("\x1b[?25l");
}

export function showCursor() {
  process.stdout.write("\x1b[?25h");
}

export function moveUp(n: number) {
  if (n > 0) process.stdout.write(`\x1b[${n}A`);
}

export function moveDown(n: number) {
  if (n > 0) process.stdout.write(`\x1b[${n}B`);
}

export function clearLine() {
  process.stdout.write("\x1b[2K\r");
}

export function clearLines(n: number) {
  for (let i = 0; i < n; i++) {
    moveUp(1);
    clearLine();
  }
}

// ==========================================
// Spinner
// ==========================================

const spinFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class Spinner {
  private frame = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private msg: string;

  constructor(msg = "") {
    this.msg = msg;
  }

  start(msg?: string) {
    if (msg) this.msg = msg;
    hideCursor();
    this.timer = setInterval(() => {
      clearLine();
      process.stdout.write(`${c.cyan}${spinFrames[this.frame % spinFrames.length]}${c.reset} ${c.dim}${this.msg}${c.reset}`);
      this.frame++;
    }, 80);
  }

  update(msg: string) {
    this.msg = msg;
  }

  stop(msg?: string) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    clearLine();
    showCursor();
    if (msg) process.stdout.write(`${c.green}✓${c.reset} ${msg}\n`);
  }

  fail(msg: string) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    clearLine();
    showCursor();
    process.stdout.write(`${c.red}✗${c.reset} ${msg}\n`);
  }
}

// ==========================================
// Box Drawing
// ==========================================

export function box(lines: string[], opts?: { title?: string; width?: number; color?: string }) {
  const color = opts?.color || c.cyan;
  const w = opts?.width || Math.max(...lines.map((l) => cstrip(l).length), opts?.title?.length || 0) + 4;
  const bar = "─".repeat(w);
  const out: string[] = [];

  out.push(`${color}╭${bar}╮${c.reset}`);
  if (opts?.title) {
    const pad = w - opts.title.length;
    const lp = Math.floor(pad / 2);
    out.push(`${color}│${c.reset}${" ".repeat(lp)}${c.bold}${opts.title}${c.reset}${" ".repeat(pad - lp)}${color}│${c.reset}`);
    out.push(`${color}├${bar}┤${c.reset}`);
  }
  for (const line of lines) {
    const len = cstrip(line).length;
    const pad = Math.max(0, w - len - 2);
    out.push(`${color}│${c.reset} ${line}${" ".repeat(pad)}${color}│${c.reset}`);
  }
  out.push(`${color}╰${bar}╯${c.reset}`);
  return out.join("\n");
}

// ==========================================
// Banner
// ==========================================

export function banner() {
  return `${c.bold}${c.cyan} ______   _______  _______  _______  _______  _______  ______   _______
(  __  \\ (  ____ \\(  ____ \\(  ____ )(  ____ \\(  ___  )(  __  \\ (  ____ \\
| (  \\  )| (    \\/| (    \\/| (    )|| (    \\/| (   ) || (  \\  )| (    \\/
| |   ) || (__    | (__    | (____)|| |      | |   | || |   ) || (__    
| |   | ||  __)   |  __)   |  _____)| |      | |   | || |   | ||  __)   
| |   ) || (      | (      | (      | |      | |   | || |   ) || (      
| (__/  )| (____/\\| (____/\\| )      | (____/\\| (___) || (__/  )| (____/\\
(______/ (_______/(_______/|/       (_______/(_______)(______/ (_______/${c.reset}`;
}

// ==========================================
// Status Line
// ==========================================

export function statusLine(parts: { label: string; value: string; color?: string }[]) {
  const segs = parts.map((p) => `${c.dim}${p.label}:${c.reset} ${p.color || c.white}${p.value}${c.reset}`);
  return segs.join(`  ${c.dim}│${c.reset}  `);
}

// ==========================================
// Key Input (raw mode)
// ==========================================

export type KeyName = "up" | "down" | "enter" | "escape" | "ctrl+c" | "tab" | "backspace" | "char";

export interface Key {
  name: KeyName;
  char?: string;
}

export function onKey(handler: (key: Key) => void): () => void {
  if (process.stdin.setRawMode) process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf-8");

  const listener = (data: string) => {
    const buf = Buffer.from(data);
    const str = data;

    if (buf[0] === 3) return handler({ name: "ctrl+c" });
    if (buf[0] === 27 && buf[1] === 91) {
      if (buf[2] === 65) return handler({ name: "up" });
      if (buf[2] === 66) return handler({ name: "down" });
      if (buf[2] === 67) return handler({ name: "tab" });
      if (buf[2] === 68) return handler({ name: "backspace" });
    }
    if (buf[0] === 13) return handler({ name: "enter" });
    if (buf[0] === 27) return handler({ name: "escape" });
    if (buf[0] === 9) return handler({ name: "tab" });
    if (buf[0] === 127) return handler({ name: "backspace" });

    handler({ name: "char", char: str });
  };

  process.stdin.on("data", listener);
  return () => {
    process.stdin.removeListener("data", listener);
    if (process.stdin.setRawMode) process.stdin.setRawMode(false);
    process.stdin.pause();
    showCursor();
  };
}

// ==========================================
// Menu (Arrow Navigation)
// ==========================================

export interface MenuItem {
  label: string;
  value: string;
  desc?: string;
  icon?: string;
  color?: string;
}

export async function menu(opts: { title: string; items: MenuItem[] }): Promise<string> {
  return new Promise((resolve) => {
    let idx = 0;
    const items = opts.items;
    const totalLines = items.length + 4; // title + padding

    const render = () => {
      clearLines(totalLines + 2);
      process.stdout.write(`${c.bold}${c.cyan}  ${opts.title}${c.reset}\n\n`);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const sel = i === idx;
        const prefix = sel ? `${c.green}${c.bold}▸ ` : "  ";
        const icon = item.icon ? `${item.icon} ` : "";
        const color = sel ? (item.color || c.white) : c.dim;
        const suffix = c.reset;

        process.stdout.write(`${prefix}${color}${icon}${item.label}${suffix}\n`);
      }

      if (items[idx].desc) {
        process.stdout.write(`\n  ${c.dim}${items[idx].desc}${c.reset}`);
      }

      process.stdout.write(`\n\n  ${c.dim}↑↓ navigate  ↵ select  esc back${c.reset}`);
    };

    render();

    const cleanup = onKey((key) => {
      if (key.name === "up") {
        idx = (idx - 1 + items.length) % items.length;
        render();
      } else if (key.name === "down") {
        idx = (idx + 1) % items.length;
        render();
      } else if (key.name === "enter") {
        cleanup();
        resolve(items[idx].value);
      } else if (key.name === "escape" || key.name === "ctrl+c") {
        cleanup();
        resolve("__back__");
      }
    });
  });
}

// ==========================================
// Input Prompt
// ==========================================

export async function prompt(opts: { placeholder?: string; color?: string }): Promise<string> {
  return new Promise((resolve) => {
    const color = opts.color || c.green;
    let input = "";
    let cursorPos = 0;

    const render = () => {
      clearLine();
      const before = input.slice(0, cursorPos);
      const after = input.slice(cursorPos);
      process.stdout.write(`${color}❯${c.reset} ${before}${c.dim}${after}${c.reset}`);
    };

    render();

    const cleanup = onKey((key) => {
      if (key.name === "enter") {
        cleanup();
        resolve(input.trim());
      } else if (key.name === "ctrl+c") {
        cleanup();
        process.exit(0);
      } else if (key.name === "backspace") {
        if (cursorPos > 0) {
          input = input.slice(0, cursorPos - 1) + input.slice(cursorPos);
          cursorPos--;
          render();
        }
      } else if (key.name === "escape") {
        cleanup();
        resolve("");
      } else if (key.char && key.char.length === 1) {
        input += key.char;
        cursorPos++;
        render();
      }
    });
  });
}

// ==========================================
// Streaming Display (word-by-word)
// ==========================================

export class StreamDisplay {
  private buf = "";
  private lines = 0;

  start() {
    this.buf = "";
    this.lines = 0;
  }

  append(text: string) {
    this.buf += text;
    // Render the new text
    process.stdout.write(text);
  }

  getBuffer() {
    return this.buf;
  }

  finish(): string {
    process.stdout.write("\n");
    return this.buf;
  }
}

// ==========================================
// Helpers
// ==========================================

export async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function termWidth(): number {
  return process.stdout.columns || 80;
}

export function pad(str: string, len: number, align: "left" | "right" = "left") {
  const diff = len - cstrip(str).length;
  if (diff <= 0) return str;
  return align === "left" ? str + " ".repeat(diff) : " ".repeat(diff) + str;
}

export function truncate(str: string, max: number) {
  const stripped = cstrip(str);
  if (stripped.length <= max) return str;
  return str.slice(0, max - 3) + "...";
}
