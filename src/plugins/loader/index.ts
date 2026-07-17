import { join } from "path";
import { existsSync } from "fs";
import { readdir, readFile } from "fs/promises";

// ==========================================
// Plugin Types
// ==========================================

export interface PluginContext {
  config: Record<string, unknown>;
  workDir: string;
  version: string;
}

export interface PluginHooks {
  "config"?: (config: Record<string, unknown>) => void | Promise<void>;
  "tool.execute.before"?: (toolName: string, args: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>;
  "tool.execute.after"?: (toolName: string, result: any) => any | Promise<any>;
  "chat.message"?: (message: any) => any | Promise<any>;
}

export interface Plugin {
  name: string;
  version?: string;
  description?: string;
  init?: (ctx: PluginContext) => Promise<PluginHooks>;
}

// ==========================================
// Plugin Loader
// ==========================================

export class PluginLoader {
  private plugins: Map<string, Plugin> = new Map();
  private hooks: Map<string, PluginHooks> = new Map();
  private searchPaths: string[];

  constructor(searchPaths: string[] = []) {
    this.searchPaths = searchPaths;
  }

  async loadPlugins(): Promise<Plugin[]> {
    for (const searchPath of this.searchPaths) {
      await this.loadFromPath(searchPath);
    }
    return Array.from(this.plugins.values());
  }

  private async loadFromPath(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) return;

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith(".js") && !entry.name.endsWith(".ts")) continue;
        
        const pluginPath = join(dirPath, entry.name);
        await this.loadPluginFile(pluginPath);
      }
    } catch (error) {
      console.error(`Failed to load plugins from ${dirPath}:`, error);
    }
  }

  private async loadPluginFile(filePath: string): Promise<void> {
    try {
      // Dynamic import
      const module = await import(filePath);
      const plugin = module.default || module;
      
      if (this.isValidPlugin(plugin)) {
        this.plugins.set(plugin.name, plugin);
      }
    } catch (error) {
      console.error(`Failed to load plugin ${filePath}:`, error);
    }
  }

  private isValidPlugin(obj: any): obj is Plugin {
    return obj && typeof obj === "object" && typeof obj.name === "string";
  }

  async initPlugins(ctx: PluginContext): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      try {
        if (plugin.init) {
          const hooks = await plugin.init(ctx);
          this.hooks.set(name, hooks);
          
          // Apply config hooks
          if (hooks.config) {
            hooks.config(ctx.config);
          }
        }
      } catch (error) {
        console.error(`Failed to initialize plugin ${name}:`, error);
      }
    }
  }

  async executeHook(hookName: string, ...args: any[]): Promise<any> {
    let result = args[0];
    
    for (const [name, hooks] of this.hooks) {
      const hook = hooks[hookName as keyof PluginHooks];
      if (hook) {
        try {
          result = await (hook as Function)(...args);
        } catch (error) {
          console.error(`Plugin ${name} hook ${hookName} failed:`, error);
        }
      }
    }
    
    return result;
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  listPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }
}
