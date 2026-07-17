# Deepcode

**Agentic Coding Assistant CLI for Termux**

Deepcode is a powerful AI-powered coding assistant designed specifically for Termux on Android. It brings the full power of AI-assisted coding to your mobile terminal with native Android integration.

## Features

### Core Features
- **Multi-Provider AI Support**: Anthropic, OpenAI, Google, and custom providers
- **BYOP/BYOK/BYOM**: Bring Your Own Provider, Key, or Model
- **Agent System**: Primary agents (build, plan, general, explore) + custom agents
- **Tool System**: File operations, shell execution, search, web tools
- **MCP Integration**: Model Context Protocol support for external tools
- **Skills System**: Extensible skill plugins
- **Plugin System**: Hook-based plugin architecture
- **Session Persistence**: Save and resume conversations

### Termux-Specific
- **Native Integration**: Built for Termux's bionic libc and $PREFIX layout
- **Storage Bridge**: Seamless access to Android shared storage
- **Notification Support**: Background task notifications via termux-api
- **Wake Lock Management**: Intelligent background processing
- **Package Distribution**: Install via Termux package manager

## Installation

### Quick Install (Termux)

```bash
# Install dependencies
pkg install nodejs npm git

# Clone and install
git clone https://github.com/yourusername/deepcode.git ~/deepcode
cd ~/deepcode
./install.sh
```

### Manual Install

```bash
# Install Node.js
pkg install nodejs npm

# Clone repository
git clone https://github.com/yourusername/deepcode.git ~/deepcode
cd ~/deepcode

# Install dependencies
npm install

# Build
npm run build

# Link globally (optional)
npm link
```

## Configuration

### API Keys

Set your API keys as environment variables:

```bash
# Anthropic (Claude)
export ANTHROPIC_API_KEY="your-key-here"

# OpenAI (GPT-4)
export OPENAI_API_KEY="your-key-here"

# Google (Gemini)
export GOOGLE_API_KEY="your-key-here"
```

### Config File

Create `~/.config/deepcode/deepcode.json`:

```json
{
  "$schema": "https://deepcode.dev/config.json",
  "model": "anthropic/claude-sonnet-4-6",
  "small_model": "anthropic/claude-3-haiku",
  "default_agent": "build",
  "permission": {
    "edit": "ask",
    "bash": {
      "git *": "allow",
      "npm *": "allow",
      "rm *": "deny",
      "*": "ask"
    }
  }
}
```

### BYOP/BYOK/BYOM

#### Bring Your Own Provider (BYOP)

Add custom OpenAI-compatible providers:

```json
{
  "provider": {
    "custom": [
      {
        "name": "ollama",
        "baseUrl": "http://localhost:11434/v1",
        "modelMap": {
          "llama3": "llama3:latest",
          "codellama": "codellama:latest"
        }
      }
    ]
  }
}
```

#### Bring Your Own Model (BYOM)

Create model aliases:

```json
{
  "provider": {
    "aliases": {
      "local/llama3": "ollama/llama3",
      "fast/gpt": "openai/gpt-4o-mini"
    }
  }
}
```

## Usage

### Interactive Mode

```bash
# Start interactive chat
deepcode

# With specific agent
deepcode -a plan

# With specific model
deepcode -m openai/gpt-4o
```

### Single Message

```bash
# Ask a question
deepcode "What does this code do?"

# Fix a bug
deepcode "Fix the bug in main.ts"

# Plan architecture
deepcode -a plan "Design a REST API for users"
```

### Commands (Interactive Mode)

- `/help` - Show available commands
- `/quit` or `/exit` - Exit interactive mode
- `/clear` - Clear screen
- `/model [name]` - Show or switch model

## Built-in Tools

| Tool | Description |
|------|-------------|
| `read` | Read file contents |
| `write` | Write to files |
| `edit` | Edit files with exact string replacement |
| `bash` | Execute shell commands |
| `glob` | Find files by pattern |
| `grep` | Search file contents with regex |

## Built-in Agents

| Agent | Description |
|-------|-------------|
| `build` | Primary agent for coding tasks |
| `plan` | Planning agent for complex tasks |
| `general` | General-purpose research agent |
| `explore` | Code exploration agent |

## MCP Integration

Configure MCP servers in your config:

```json
{
  "mcp": {
    "filesystem": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem"],
      "enabled": true
    },
    "github": {
      "type": "remote",
      "url": "https://mcp-github.example.com",
      "headers": {
        "Authorization": "Bearer {env:GITHUB_TOKEN}"
      }
    }
  }
}
```

## Skills

Create custom skills in `.deepcode/skill/my-skill/SKILL.md`:

```markdown
---
name: my-skill
description: Use when user asks about specific topic
---

# My Skill

Instructions for the skill go here.
```

## Project Structure

```
deepcode/
├── src/
│   ├── cli/           # CLI entry point
│   ├── core/          # Core modules
│   │   ├── agent/     # Agent system
│   │   ├── config/    # Configuration
│   │   ├── provider/  # AI providers
│   │   └── session/   # Session management
│   ├── tools/         # Tool implementations
│   ├── mcp/           # MCP client
│   ├── skills/        # Skills loader
│   └── plugins/       # Plugin system
├── dist/              # Compiled output
├── package.json
└── tsconfig.json
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode
npm run dev

# Type check
npm run typecheck
```

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
