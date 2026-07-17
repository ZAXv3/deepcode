import { readFile, readdir, stat } from "fs/promises";
import { existsSync } from "fs";
import { join, resolve } from "path";

// ==========================================
// Skill Types
// ==========================================

export interface SkillDefinition {
  name: string;
  description: string;
  content: string;
  path: string;
  metadata?: Record<string, string>;
}

// ==========================================
// Skill Loader
// ==========================================

export class SkillLoader {
  private skills: Map<string, SkillDefinition> = new Map();
  private searchPaths: string[];

  constructor(searchPaths: string[] = []) {
    this.searchPaths = searchPaths;
  }

  async loadSkills(): Promise<SkillDefinition[]> {
    for (const searchPath of this.searchPaths) {
      await this.loadFromPath(searchPath);
    }
    return Array.from(this.skills.values());
  }

  private async loadFromPath(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) return;

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const skillDir = join(dirPath, entry.name);
        const skillFile = join(skillDir, "SKILL.md");
        
        if (existsSync(skillFile)) {
          const skill = await this.loadSkillFile(skillFile);
          if (skill) {
            this.skills.set(skill.name, skill);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to load skills from ${dirPath}:`, error);
    }
  }

  private async loadSkillFile(filePath: string): Promise<SkillDefinition | null> {
    try {
      const content = await readFile(filePath, "utf-8");
      return this.parseSkillFile(content, filePath);
    } catch (error) {
      console.error(`Failed to load skill file ${filePath}:`, error);
      return null;
    }
  }

  private parseSkillFile(content: string, filePath: string): SkillDefinition | null {
    // Parse frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    let name = "";
    let description = "";
    let metadata: Record<string, string> = {};
    let body = content;

    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      body = frontmatterMatch[2];

      // Simple YAML parsing
      for (const line of frontmatter.split("\n")) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          const [, key, value] = match;
          if (key === "name") name = value.trim();
          else if (key === "description") description = value.trim();
          else metadata[key] = value.trim();
        }
      }
    }

    // Extract name from directory if not in frontmatter
    if (!name) {
      const dirName = filePath.split("/").slice(-2, -1)[0];
      name = dirName || "unknown";
    }

    if (!description) {
      // Extract first paragraph as description
      const firstParagraph = body.split("\n\n")[0];
      description = firstParagraph.replace(/^#+\s*/, "").slice(0, 200);
    }

    return {
      name,
      description,
      content: body,
      path: filePath,
      metadata,
    };
  }

  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  listSkills(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  searchSkills(query: string): SkillDefinition[] {
    const lowerQuery = query.toLowerCase();
    return this.listSkills().filter(
      (skill) =>
        skill.name.toLowerCase().includes(lowerQuery) ||
        skill.description.toLowerCase().includes(lowerQuery)
    );
  }
}
