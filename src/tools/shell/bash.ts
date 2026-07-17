import { exec, spawn } from "child_process";
import { promisify } from "util";
import { Tool, ToolDefinition, ToolResult } from "../index.js";

const execAsync = promisify(exec);

// ==========================================
// Bash Tool
// ==========================================

export class BashTool extends Tool {
  readonly definition: ToolDefinition = {
    name: "bash",
    description: "Execute a bash command and return its output. Use for running shell commands, scripts, and system operations.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The bash command to execute.",
        },
        workdir: {
          type: "string",
          description: "The working directory to run the command in (defaults to current directory).",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default: 120000).",
        },
      },
      required: ["command"],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const command = args.command as string;
    const workdir = (args.workdir as string) || process.cwd();
    const timeout = (args.timeout as number) || 120000;

    try {
      // Security: Block dangerous commands
      if (this.isDangerous(command)) {
        return {
          output: "",
          error: "Command blocked for security reasons. This command could be dangerous.",
        };
      }

      const { stdout, stderr } = await execAsync(command, {
        cwd: workdir,
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        env: {
          ...process.env,
          TERM: "dumb",
          NO_COLOR: "1",
        },
      });

      let output = stdout;
      if (stderr) {
        output += (output ? "\n" : "") + stderr;
      }

      // Truncate if too long
      const maxLines = 2000;
      const lines = output.split("\n");
      if (lines.length > maxLines) {
        output = lines.slice(0, maxLines).join("\n") + `\n\n(Output truncated: ${lines.length} lines)`;
      }

      return { output: output || "(no output)" };
    } catch (error: any) {
      if (error.killed) {
        return { output: "", error: `Command timed out after ${timeout}ms` };
      }
      
      let output = error.stdout || "";
      if (error.stderr) {
        output += (output ? "\n" : "") + error.stderr;
      }

      return {
        output: output || "",
        error: `Command failed with exit code ${error.code || "unknown"}`,
      };
    }
  }

  private isDangerous(command: string): boolean {
    const dangerous = [
      /\brm\s+-rf\s+\/\b/,  // rm -rf /
      /\bmkfs\b/,           // Format filesystem
      /\bdd\s+if=.*of=\/dev\//,  // dd to device
      /\b:\(\)\{\s*:\|:&\s*\};:/,  // Fork bomb
      /\bcurl\s+.*\|\s*bash/,  // Pipe to bash (could be dangerous)
      /\bwget\s+.*\|\s*bash/,
    ];

    return dangerous.some((regex) => regex.test(command));
  }
}
