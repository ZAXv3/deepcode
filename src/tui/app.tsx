import React, { useState } from "react";
import { render, Text, Box, useInput, useApp } from "ink";
import { ProviderRegistry } from "../core/provider/index.js";
import { AgentOrchestrator, AgentSession } from "../core/agent/orchestrator.js";
import { ToolRegistry } from "../tools/index.js";

type View = "menu" | "chat" | "models" | "agents" | "tools" | "settings" | "exit";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  providers: ProviderRegistry;
  orchestrator: AgentOrchestrator;
  tools: ToolRegistry;
}

const MENU = [
  { label: "💬  Chat", value: "chat" as View, desc: "Start a conversation with an AI agent" },
  { label: "🧠  Models", value: "models" as View, desc: "Select or discover available models" },
  { label: "🤖  Agents", value: "agents" as View, desc: "Choose an agent persona" },
  { label: "🔧  Tools", value: "tools" as View, desc: "View available tools" },
  { label: "⚙️   Settings", value: "settings" as View, desc: "Configure API keys" },
  { label: "🚪  Exit", value: "exit" as View, desc: "Quit Deepcode" },
];

export function DeepcodeApp({ providers, orchestrator, tools }: Props) {
  const { exit } = useApp();
  const [view, setView] = useState<View>("menu");
  const [idx, setIdx] = useState(0);
  const [model, setModel] = useState("anthropic/claude-sonnet-4-6");
  const [agent, setAgent] = useState("build");
  const [session, setSession] = useState<AgentSession | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

  const models = providers.listModels();
  const agents = orchestrator.listAgents();
  const toolList = tools.list();

  useInput((ch, key) => {
    if (key.ctrl && ch === "c") return exit();

    // BACK
    if (key.escape || (key.return && view === "settings") || (key.return && view === "tools")) {
      setView("menu");
      setIdx(0);
      return;
    }

    // MENU
    if (view === "menu") {
      if (key.upArrow) setIdx((i) => (i - 1 + MENU.length) % MENU.length);
      if (key.downArrow) setIdx((i) => (i + 1) % MENU.length);
      if (key.return) {
        const v = MENU[idx].value;
        if (v === "exit") exit();
        else { setView(v); setIdx(0); }
      }
      return;
    }

    // MODELS
    if (view === "models") {
      if (key.upArrow) setIdx((i) => (i - 1 + models.length) % models.length);
      if (key.downArrow) setIdx((i) => (i + 1) % models.length);
      if (key.return && models[idx]) {
        setModel(models[idx].fullId);
        setView("menu");
        setIdx(0);
      }
      return;
    }

    // AGENTS
    if (view === "agents") {
      if (key.upArrow) setIdx((i) => (i - 1 + agents.length) % agents.length);
      if (key.downArrow) setIdx((i) => (i + 1) % agents.length);
      if (key.return && agents[idx]) {
        setAgent(agents[idx].name);
        setView("menu");
        setIdx(0);
      }
      return;
    }

    // CHAT
    if (view === "chat") {
      if (key.return && input.trim() && !thinking) {
        const userMsg = input.trim();
        setInput("");
        setMsgs((m) => [...m, { role: "user", content: userMsg }]);
        setThinking(true);

        (async () => {
          try {
            let sid = session?.id;
            if (!sid) {
              sid = orchestrator.createSession(agent);
              setSession(orchestrator.getSession(sid)!);
            }
            const res = await orchestrator.processMessage(
              sid,
              userMsg,
              { model }
            );
            setMsgs((m) => [...m, { role: "assistant", content: res }]);
          } catch (e: any) {
            setMsgs((m) => [...m, { role: "assistant", content: `Error: ${e.message}` }]);
          }
          setThinking(false);
        })();
        return;
      }
      if (key.backspace) {
        setInput((s) => s.slice(0, -1));
        return;
      }
      if (!key.ctrl && !key.meta && ch.length === 1) {
        setInput((s) => s + ch);
      }
    }
  });

  // ── HEADER ──
  const Header = () => (
    <Box flexDirection="column" gap={0}>
      <Text color="cyan" bold>
        {" "}
        ╔═══════════════════════════════════════════════════════════╗
      </Text>
      <Text color="cyan" bold>
        {" "}
        ║{" "}
        <Text color="white" bold>
          deepcode
        </Text>{" "}
        <Text color="gray">│ v0.2.0 │ Agentic Coding for Termux</Text>{" "}
        ║
      </Text>
      <Text color="cyan" bold>
        {" "}
        ╚═══════════════════════════════════════════════════════════╝
      </Text>
    </Box>
  );

  // ── MENU VIEW ──
  if (view === "menu") {
    return (
      <Box flexDirection="column">
        <Header />
        <Box flexDirection="column" paddingLeft={2}>
          {MENU.map((item, i) => (
            <Text key={item.value} color={i === idx ? "green" : undefined} bold={i === idx}>
              {i === idx ? " ▸ " : "   "}
              {item.label}
              {i === idx ? <Text color="gray"> — {item.desc}</Text> : null}
            </Text>
          ))}
        </Box>
        <Text dimColor>{"\n"} ↑↓ navigate │ ↵ select │ ctrl+c exit</Text>
      </Box>
    );
  }

  // ── MODELS VIEW ──
  if (view === "models") {
    return (
      <Box flexDirection="column">
        <Header />
        <Text bold color="cyan">
          {"\n"} Select Model
        </Text>
        <Box flexDirection="column" paddingLeft={2}>
          {models.length === 0 ? (
            <Text color="yellow">⚠ No models. Configure API keys in settings.</Text>
          ) : (
            models.map((m, i) => (
              <Text key={m.fullId} color={i === idx ? "green" : undefined} bold={i === idx}>
                {i === idx ? " ▸ " : "   "}
                {m.fullId}
              </Text>
            ))
          )}
        </Box>
        <Text dimColor>{"\n"} ↑↓ select │ ↵ confirm │ esc back</Text>
      </Box>
    );
  }

  // ── AGENTS VIEW ──
  if (view === "agents") {
    return (
      <Box flexDirection="column">
        <Header />
        <Text bold color="magenta">
          {"\n"} Select Agent
        </Text>
        <Box flexDirection="column" paddingLeft={2}>
          {agents.map((a, i) => (
            <Text key={a.name} color={i === idx ? "green" : undefined} bold={i === idx}>
              {i === idx ? " ▸ " : "   "}
              {a.name}
              <Text color="gray"> — {a.description || ""}</Text>
            </Text>
          ))}
        </Box>
        <Text dimColor>{"\n"} ↑↓ select │ ↵ confirm │ esc back</Text>
      </Box>
    );
  }

  // ── TOOLS VIEW ──
  if (view === "tools") {
    return (
      <Box flexDirection="column">
        <Header />
        <Text bold color="yellow">
          {"\n"} {toolList.length} Tools Available
        </Text>
        <Box flexDirection="column" paddingLeft={2}>
          {toolList.map((t) => (
            <Text key={t.definition.name}>
              <Text color="green" bold>
                ✓{" "}
              </Text>
              <Text bold>{t.definition.name}</Text>
              <Text color="gray"> — {t.definition.description}</Text>
            </Text>
          ))}
        </Box>
        <Text dimColor>{"\n"} press any key to go back</Text>
      </Box>
    );
  }

  // ── SETTINGS VIEW ──
  if (view === "settings") {
    return (
      <Box flexDirection="column">
        <Header />
        <Text bold color="blue">
          {"\n"} Settings
        </Text>
        <Box flexDirection="column" paddingLeft={2}>
          <Text>
            🔑 API Keys:{" "}
            <Text color="gray">Set via environment variables</Text>
          </Text>
          <Text>
            🧠 Default Model: <Text color="cyan" bold>{model}</Text>
          </Text>
          <Text>
            🤖 Default Agent: <Text color="magenta" bold>{agent}</Text>
          </Text>
          <Text color="gray" dimColor>
            {"\n"} export ANTHROPIC_API_KEY="sk-..."
          </Text>
        </Box>
        <Text dimColor>{"\n"} press any key to go back</Text>
      </Box>
    );
  }

  // ── CHAT VIEW ──
  return (
    <Box flexDirection="column" height="100%">
      <Header />
      <Text color="gray">
        {" "}
        Chat │ <Text color="cyan">{model}</Text> │{" "}
        <Text color="magenta">{agent}</Text> │ esc back
      </Text>
      <Box flexDirection="column" flexGrow={1} paddingTop={1}>
        {msgs.length === 0 && (
          <Text color="gray" dimColor>
            {"  "}Start typing to chat...
          </Text>
        )}
        {msgs.map((m, i) => (
          <Box key={i} flexDirection="column" gap={0}>
            <Text bold color={m.role === "user" ? "green" : "cyan"}>
              {m.role === "user" ? " ❯ You" : " ◆ assistant"}
            </Text>
            <Box paddingLeft={2}>
              <Text wrap="wrap">{m.content}</Text>
            </Box>
          </Box>
        ))}
        {thinking && (
          <Text color="yellow">
            {"  "}⠋ Thinking...
          </Text>
        )}
      </Box>
      <Box borderStyle="round" borderColor="green" paddingLeft={1}>
        <Text color="green" bold>
          ❯{" "}
        </Text>
        <Text>
          {input}
          <Text color="gray" inverse>
            {" "}
          </Text>
        </Text>
      </Box>
    </Box>
  );
}

export function launchTUI(providers: ProviderRegistry, orchestrator: AgentOrchestrator, tools: ToolRegistry) {
  render(<DeepcodeApp providers={providers} orchestrator={orchestrator} tools={tools} />, {
    exitOnCtrlC: true,
  });
}
