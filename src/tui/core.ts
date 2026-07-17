// ==========================================
// Terminal UI Core - Colors, Formatting, Animations
// ==========================================

export const Colors = {
  // Standard
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  blink: "\x1b[5m",
  inverse: "\x1b[7m",
  strikethrough: "\x1b[9m",

  // Foreground
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  // Bright foreground
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",

  // Background
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",
} as const;

export const Emojis = {
  rocket: "🚀",
  sparkles: "✨",
  star: "⭐",
  check: "✅",
  cross: "❌",
  warning: "⚠️",
  info: "ℹ️",
  arrow: "→",
  bullet: "•",
  diamond: "◆",
  circle: "●",
  square: "■",
  triangle: "▲",
  gear: "⚙️",
  brain: "🧠",
  code: "💻",
  terminal: "\ufe92",
  folder: "📁",
  file: "📄",
  search: "🔍",
  link: "🔗",
  clock: "🕐",
  lightning: "⚡",
  fire: "🔥",
  wave: "👋",
  party: "🎉",
  robot: "🤖",
  wrench: "🔧",
  door: "🚪",
  key: "🔑",
  settings: "⚙️",
  chat: "💬",
  bell: "🔔",
  trash: "🗑️",
  save: "💾",
  download: "⬇️",
  upload: "⬆️",
  refresh: "🔄",
  lock: "🔒",
  unlock: "🔓",
  heart: "❤️",
  thumbsUp: "👍",
  thumbsDown: "👎",
  flag: "🚩",
  bookmark: "🔖",
  tag: "🏷️",
  pin: "📌",
  eye: "👁️",
  magnifier: "🔎",
  lightbulb: "💡",
  tools: "🛠️",
  hammer: "🔨",
  screwdriver: "🪛",
  paintbrush: "🖌️",
  palette: "🎨",
  camera: "📷",
  microphone: "🎤",
  speaker: "🔊",
  music: "🎵",
  film: "🎬",
  gamepad: "🎮",
  puzzle: "🧩",
  dice: "🎲",
  cards: "🃏",
  crystal: "🔮",
  magic: "🪄",
  wand: "🪄",
  crown: "👑",
  gem: "💎",
  trophy: "🏆",
  medal: "🏅",
  ribbon: "🎀",
  gift: "🎁",
  balloon: "🎈",
  confetti: "🎉",
  partyPopper: "🎊",
  fireworks: "🎆",
  sparkler: "🎇",
  dawn: "🌅",
  sunset: "🌇",
  rainbow: "🌈",
  cloud: "☁️",
  sun: "☀️",
  moon: "🌙",
  star2: "⭐",
  comet: "☄️",
  umbrella: "☂️",
  snowflake: "❄️",
  water: "💧",
  fire2: "🔥",
  tornado: "🌪️",
  volcano: "🌋",
  mountain: "🏔️",
  camping: "🏕️",
  beach: "🏖️",
  palm: "🌴",
  cactus: "🌵",
  tree: "🌳",
  flower: "🌸",
  rose: "🌹",
  tulip: "🌷",
  seedling: "🌱",
  herb: "🌿",
  leaf: "🍃",
  fallenLeaf: "🍂",
  mushroom: "🍄",
  nut: "🌰",
  chestnut: "🌰",
} as const;

// ==========================================
// Animation Helpers
// ==========================================

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function typewriter(
  text: string,
  options?: {
    speed?: number;
    stream?: boolean;
    onChar?: (char: string, index: number) => void;
  }
): Promise<void> {
  const speed = options?.speed || 20;
  for (let i = 0; i < text.length; i++) {
    process.stdout.write(text[i]);
    if (options?.onChar) options.onChar(text[i], i);
    if (!options?.stream || text[i] !== " ") {
      await sleep(speed);
    }
  }
}

// ==========================================
// Spinner Animation
// ==========================================

const SPINNERS = {
  dots: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  line: ["-", "\\", "|", "/"],
  dot: ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"],
  star: ["✦", "✧", "✦", "✧"],
  pulse: [" ◐", " ◑", " ◒", " ◓", " ◔", " ◕", " ◖", " ◗"],
  brain: ["🧠", "💭", "🧠", "💭"],
  rocket: ["🚀", "✈️", "🛫", "✈️", "🚀"],
  wave: ["👋", "🤚", "🖐️", "✋", "🖖", "🖐️", "🤚", "👋"],
} as const;

export type SpinnerStyle = keyof typeof SPINNERS;

export class Spinner {
  private frames: readonly string[];
  private frameIndex = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private text: string;
  private color: string;
  private isActive = false;

  constructor(options?: {
    text?: string;
    style?: SpinnerStyle;
    color?: string;
  }) {
    this.text = options?.text || "";
    this.frames = SPINNERS[options?.style || "dots"];
    this.color = options?.color || Colors.cyan;
  }

  start(text?: string): void {
    if (text) this.text = text;
    this.isActive = true;
    this.frameIndex = 0;

    // Hide cursor
    process.stdout.write("\x1b[?25l");

    this.interval = setInterval(() => {
      if (!this.isActive) return;
      const frame = this.frames[this.frameIndex % this.frames.length];
      process.stdout.write(`\r${this.color}${frame}${Colors.reset} ${this.text}   `);
      this.frameIndex++;
    }, 80);
  }

  updateText(text: string): void {
    this.text = text;
  }

  stop(finalText?: string): void {
    this.isActive = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    // Show cursor
    process.stdout.write("\x1b[?25h");

    if (finalText) {
      process.stdout.write(`\r${Colors.green}✓${Colors.reset} ${finalText}\n`);
    } else {
      process.stdout.write("\r" + " ".repeat(this.text.length + 10) + "\r");
    }
  }

  fail(errorText: string): void {
    this.isActive = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write("\x1b[?25h");
    process.stdout.write(`\r${Colors.red}✗${Colors.reset} ${errorText}\n`);
  }
}

// ==========================================
// Progress Bar
// ==========================================

export class ProgressBar {
  private total: number;
  private current = 0;
  private width: number;
  private color: string;

  constructor(options?: { total?: number; width?: number; color?: string }) {
    this.total = options?.total || 100;
    this.width = options?.width || 30;
    this.color = options?.color || Colors.cyan;
  }

  update(current: number, label?: string): void {
    this.current = current;
    const percent = Math.round((current / this.total) * 100);
    const filled = Math.round((current / this.total) * this.width);
    const empty = this.width - filled;

    const bar = `${this.color}${"█".repeat(filled)}${Colors.dim}${"░".repeat(empty)}${Colors.reset}`;
    const text = label || `${percent}%`;

    process.stdout.write(`\r  ${bar} ${text}   `);
  }

  complete(label?: string): void {
    this.update(this.total, label || "100%");
    process.stdout.write("\n");
  }
}

// ==========================================
// Box Drawing
// ==========================================

export function drawBox(
  content: string,
  options?: {
    title?: string;
    color?: string;
    padding?: number;
    width?: number;
  }
): string {
  const color = options?.color || Colors.cyan;
  const padding = options?.padding || 1;
  const lines = content.split("\n");
  const maxWidth = options?.width || Math.max(...lines.map((l) => stripAnsi(l).length), options?.title?.length || 0);
  const innerWidth = maxWidth + padding * 2;

  const top = `${color}╭${"─".repeat(innerWidth)}╮${Colors.reset}`;
  const bottom = `${color}╰${"─".repeat(innerWidth)}╯${Colors.reset}`;
  const emptyLine = `${color}│${" ".repeat(innerWidth)}│${Colors.reset}`;

  const result: string[] = [top];

  if (options?.title) {
    const titlePad = Math.max(0, innerWidth - options.title.length);
    const leftPad = Math.floor(titlePad / 2);
    const rightPad = titlePad - leftPad;
    result.push(
      `${color}│${" ".repeat(leftPad)}${Colors.bold}${options.title}${Colors.reset}${color}${" ".repeat(rightPad)}│${Colors.reset}`
    );
    result.push(`${color}├${"─".repeat(innerWidth)}┤${Colors.reset}`);
  }

  for (const line of lines) {
    const lineLen = stripAnsi(line).length;
    const pad = Math.max(0, innerWidth - lineLen - padding * 2);
    result.push(
      `${color}│${" ".repeat(padding)}${line}${" ".repeat(pad + padding)}${Colors.reset}${color}│${Colors.reset}`
    );
  }

  result.push(bottom);
  return result.join("\n");
}

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

// ==========================================
// Logo / Banner
// ==========================================

export function drawLogo(): string {
  const logo = `
${Colors.bold}${Colors.cyan} ______   _______  _______  _______  _______  _______  ______   _______
(  __  \\ (  ____ \\(  ____ \\(  ____ )(  ____ \\(  ___  )(  __  \\ (  ____ \\
| (  \\  )| (    \\/| (    \\/| (    )|| (    \\/| (   ) || (  \\  )| (    \\/
| |   ) || (__    | (__    | (____)|| |      | |   | || |   ) || (__    
| |   | ||  __)   |  __)   |  _____)| |      | |   | || |   | ||  __)   
| |   ) || (      | (      | (      | |      | |   | || |   ) || (      
| (__/  )| (____/\\| (____/\\| )      | (____/\\| (___) || (__/  )| (____/\\
(______/ (_______/(_______/|/       (_______/(_______)(______/ (_______/
${Colors.reset}${Colors.dim}                  Agentic Coding Assistant for Termux${Colors.reset}`;

  return logo;
}

// ==========================================
// Status Bar
// ==========================================

export function drawStatusBar(options?: {
  model?: string;
  agent?: string;
  tokens?: number;
  session?: string;
}): string {
  const parts: string[] = [];

  if (options?.model) {
    parts.push(`${Colors.cyan}Model:${Colors.reset} ${options.model}`);
  }
  if (options?.agent) {
    parts.push(`${Colors.green}Agent:${Colors.reset} ${options.agent}`);
  }
  if (options?.tokens) {
    parts.push(`${Colors.yellow}Tokens:${Colors.reset} ${options.tokens.toLocaleString()}`);
  }
  if (options?.session) {
    parts.push(`${Colors.dim}Session:${Colors.reset} ${options.session.slice(0, 8)}`);
  }

  const line = parts.join(` ${Colors.dim}│${Colors.reset} `);
  const width = stripAnsi(line).length;
  const termWidth = process.stdout.columns || 80;
  const pad = Math.max(0, termWidth - width - 2);

  return `\n${Colors.dim}${"─".repeat(termWidth - 1)}${Colors.reset}\n${line}${" ".repeat(pad)}\n${Colors.dim}${"─".repeat(termWidth - 1)}${Colors.reset}`;
}

// ==========================================
// Interactive Menu
// ==========================================

export interface MenuItem {
  label: string;
  value: string;
  description?: string;
  icon?: string;
  color?: string;
  disabled?: boolean;
}

export class InteractiveMenu {
  private items: MenuItem[];
  private selectedIndex = 0;
  private title: string;
  private columns: number;

  constructor(options: {
    title: string;
    items: MenuItem[];
    columns?: number;
  }) {
    this.title = options.title;
    this.items = options.items;
    this.columns = options.columns || 1;
  }

  async show(): Promise<string> {
    // Hide cursor
    process.stdout.write("\x1b[?25l");

    const render = () => {
      // Move up and clear
      process.stdout.write("\x1b[2J\x1b[H");

      console.log(`\n${Colors.bold}${Colors.cyan}${this.title}${Colors.reset}\n`);
      console.log(`${Colors.dim}Use ↑/↓ to navigate, Enter to select, q to quit${Colors.reset}\n`);

      const cols = this.columns;
      const rows = Math.ceil(this.items.length / cols);

      for (let row = 0; row < rows; row++) {
        let line = "";
        for (let col = 0; col < cols; col++) {
          const idx = row + col * rows;
          if (idx >= this.items.length) break;

          const item = this.items[idx];
          const isSelected = idx === this.selectedIndex;
          const prefix = isSelected ? `${Colors.bold}${Colors.green}▸ ` : "  ";
          const suffix = isSelected ? Colors.reset : item.disabled ? Colors.dim : "";
          const icon = item.icon ? `${item.icon} ` : "";
          const color = item.color || "";

          line += `${prefix}${color}${icon}${item.label}${suffix}    `;
        }
        console.log(line);
      }

      // Show description of selected item
      const selected = this.items[this.selectedIndex];
      if (selected.description) {
        console.log(`\n${Colors.dim}${selected.description}${Colors.reset}`);
      }
    };

    render();

    return new Promise((resolve) => {
      const onKey = (data: Buffer) => {
        const key = data.toString();

        if (key === "\x1b[A") {
          // Up arrow
          this.selectedIndex = Math.max(0, this.selectedIndex - 1);
          render();
        } else if (key === "\x1b[B") {
          // Down arrow
          this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
          render();
        } else if (key === "\r" || key === "\n") {
          // Enter
          cleanup();
          resolve(this.items[this.selectedIndex].value);
        } else if (key === "q" || key === "\x03") {
          // q or Ctrl+C
          cleanup();
          process.exit(0);
        }
      };

      const cleanup = () => {
        process.stdin.removeListener("data", onKey);
        process.stdin.setRawMode?.(false);
        process.stdin.pause();
        // Show cursor
        process.stdout.write("\x1b[?25h");
      };

      process.stdin.setRawMode?.(true);
      process.stdin.resume();
      process.stdin.on("data", onKey);
    });
  }
}

// ==========================================
// Streaming Text Display
// ==========================================

export class StreamingDisplay {
  private buffer = "";
  private isStreaming = false;
  private lastLength = 0;

  start(): void {
    this.isStreaming = true;
    this.buffer = "";
    this.lastLength = 0;
  }

  append(text: string): void {
    if (!this.isStreaming) return;

    // Clear previous output
    if (this.lastLength > 0) {
      const lines = this.buffer.split("\n");
      process.stdout.write(`\x1b[${lines.length}A`);
      for (let i = 0; i < lines.length; i++) {
        process.stdout.write(`\x1b[2K\r`);
        if (i < lines.length - 1) process.stdout.write("\n");
      }
      process.stdout.write(`\x1b[${lines.length - 1}A`);
    }

    this.buffer += text;

    // Print current state
    process.stdout.write(this.buffer);
    this.lastLength = this.buffer.split("\n").length;
  }

  finish(): string {
    this.isStreaming = false;
    const result = this.buffer;
    this.buffer = "";
    this.lastLength = 0;
    return result;
  }
}

// ==========================================
// Clear Screen
// ==========================================

export function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

// ==========================================
// Prompt
// ==========================================

export async function prompt(question: string): Promise<string> {
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${Colors.cyan}?${Colors.reset} ${Colors.bold}${question}${Colors.reset} `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function confirm(question: string): Promise<boolean> {
  const answer = await prompt(`${question} (y/n)`);
  return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
}
