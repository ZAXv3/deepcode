import { mkdir, readFile, writeFile, readdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { AgentSession } from "../agent/orchestrator.js";
import { AgentConfig } from "../agent/types.js";
import { Message } from "../provider/types.js";

// ==========================================
// Session Persistence
// ==========================================

export interface SessionMetadata {
  id: string;
  agentName: string;
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
  title?: string;
}

export class SessionManager {
  private sessionsDir: string;
  private sessions: Map<string, AgentSession> = new Map();

  constructor(sessionsDir?: string) {
    this.sessionsDir = sessionsDir || join(process.env.HOME || "", ".local", "share", "deepcode", "sessions");
  }

  async init(): Promise<void> {
    if (!existsSync(this.sessionsDir)) {
      await mkdir(this.sessionsDir, { recursive: true });
    }
  }

  async saveSession(session: AgentSession): Promise<void> {
    const sessionDir = join(this.sessionsDir, session.id);
    
    if (!existsSync(sessionDir)) {
      await mkdir(sessionDir, { recursive: true });
    }

    // Save messages
    const messagesFile = join(sessionDir, "messages.json");
    await writeFile(messagesFile, JSON.stringify(session.messages, null, 2));

    // Save metadata
    const metadata: SessionMetadata = {
      id: session.id,
      agentName: session.agent.name,
      startedAt: session.startedAt.toISOString(),
      lastMessageAt: new Date().toISOString(),
      messageCount: session.messages.length,
      title: this.generateTitle(session.messages),
    };

    const metadataFile = join(sessionDir, "metadata.json");
    await writeFile(metadataFile, JSON.stringify(metadata, null, 2));
  }

  async loadSession(sessionId: string, agent: AgentConfig): Promise<AgentSession | null> {
    const sessionDir = join(this.sessionsDir, sessionId);
    const messagesFile = join(sessionDir, "messages.json");
    const metadataFile = join(sessionDir, "metadata.json");

    if (!existsSync(messagesFile)) {
      return null;
    }

    try {
      const messagesContent = await readFile(messagesFile, "utf-8");
      const messages: Message[] = JSON.parse(messagesContent);

      const metadataContent = await readFile(metadataFile, "utf-8");
      const metadata: SessionMetadata = JSON.parse(metadataContent);

      return {
        id: sessionId,
        agent,
        messages,
        startedAt: new Date(metadata.startedAt),
      };
    } catch (error) {
      console.error(`Failed to load session ${sessionId}:`, error);
      return null;
    }
  }

  async listSessions(): Promise<SessionMetadata[]> {
    if (!existsSync(this.sessionsDir)) {
      return [];
    }

    const entries = await readdir(this.sessionsDir, { withFileTypes: true });
    const sessions: SessionMetadata[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const metadataFile = join(this.sessionsDir, entry.name, "metadata.json");
      if (existsSync(metadataFile)) {
        try {
          const content = await readFile(metadataFile, "utf-8");
          sessions.push(JSON.parse(content));
        } catch {
          // Skip invalid metadata
        }
      }
    }

    return sessions.sort((a, b) => 
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const sessionDir = join(this.sessionsDir, sessionId);
    
    if (!existsSync(sessionDir)) {
      return false;
    }

    try {
      const files = await readdir(sessionDir);
      for (const file of files) {
        await unlink(join(sessionDir, file));
      }
      // Try to remove the directory (will fail if not empty, but that's ok)
      const { rmdir } = await import("fs/promises");
      await rmdir(sessionDir).catch(() => {});
      return true;
    } catch (error) {
      console.error(`Failed to delete session ${sessionId}:`, error);
      return false;
    }
  }

  private generateTitle(messages: Message[]): string {
    // Use first user message as title
    const firstUserMessage = messages.find(m => m.role === "user");
    if (firstUserMessage && typeof firstUserMessage.content === "string") {
      return firstUserMessage.content.slice(0, 100) + (firstUserMessage.content.length > 100 ? "..." : "");
    }
    return "Untitled Session";
  }
}
