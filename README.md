# QQ Bot MCP for Claude Code

> **Original Documentation**: [README.old.md](README.old.md) | **[简体中文](README.zh.md)**

A Claude Code plugin that enables bidirectional communication between Claude Code and QQ through the Model Context Protocol (MCP).

[![npm version](https://img.shields.io/npm/v/@sliverp/qqbot-mcp?color=blue&label=npm)](https://www.npmjs.com/package/@sliverp/qqbot-mcp)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js->=18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

**[简体中文](README.zh.md) | English**

---

## Features

- **MCP Integration** - Full MCP server with 5 core tools
- **Background Gateway** - WebSocket daemon for real-time QQ message handling
- **Multi-Project Support** - Register multiple projects with independent sessions and bot credentials
- **Project-Level Configuration** - Each project can have its own QQ Bot credentials
- **Smart Message Parsing** - Auto-detect project names, tool permissions, and modes
- **Hook System** - Configure project-level hooks for QQ notifications
- **Auto-Reply Mode** - Automatic Claude Code headless mode integration

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   QQ Client     │────▶│  QQ Bot Gateway  │────▶│  Claude Code    │
│   (User)        │     │  (WebSocket)     │     │  (Headless)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Message Parser  │
                        │  - Project name  │
                        │  - Tool perms    │
                        │  - Permission    │
                        └──────────────────┘
```

### Core Components

| Component | File | Description |
|-----------|------|-------------|
| MCP Server | `src/mcp/` | MCP protocol implementation with 5 tools |
| Gateway Daemon | `scripts/qqbot-gateway.js` | WebSocket daemon for QQ Bot |
| Message Parser | `scripts/qqbot-parser.js` | Smart message parsing |
| Hook Manager | `scripts/qqbot-hooks.js` | Project-level hook configuration |
| Doctor | `scripts/doctor.js` | Diagnostic tool |
| Setup Wizard | `scripts/setup-wizard.js` | Interactive configuration |

---

## Quick Start (5 Minutes)

### Prerequisites

1. **Claude Code CLI** installed
2. **QQ Bot credentials** from [QQ Open Platform](https://q.qq.com/)

### Step 1: Install Plugin

**Option A: Install from Marketplace (Recommended)**

```bash
# In Claude Code CLI
/plugin marketplace add https://github.com/fuzhibo/qqbot-claudecode-skill
```

**Option B: Install from Local Directory**

```bash
# Clone and build
git clone https://github.com/fuzhibo/qqbot-claudecode-skill.git
cd qqbot-claudecode-skill
npm install && npm run build

# Add to Claude Code
claude plugin add /path/to/qqbot-claudecode-skill
```

### Step 2: Configure Project Credentials

Create a `.env` file in your project directory (not the plugin directory):

```bash
# In your project root
cat > .env << 'EOF'
QQBOT_APP_ID=your-app-id-here
QQBOT_CLIENT_SECRET=your-client-secret-here
QQBOT_IMAGE_SERVER_BASE_URL=http://your-server:18765
EOF
```

> **Note**: Each project can have its own QQ Bot credentials. Configuration is stored in `~/.claude/qqbot-gateway/projects.json`.

### Step 3: Register Your Project

```bash
# Register current project
node /path/to/qqbot-claudecode-skill/scripts/qqbot-gateway.js register $(pwd) --name my-project

# Or use the skill
/qqbot-service register $(pwd) --name my-project
```

### Step 4: Start Gateway

```bash
# Notify mode (desktop notifications only)
npm run gateway:start

# Auto-reply mode (AI responds automatically)
npm run gateway:start -- --auto
```

### Step 5: Test

Send a message to your QQ Bot, Claude Code will respond automatically (in auto mode) or show a desktop notification (in notify mode).

---

## Installation Details

### Install from Marketplace

```bash
# Add plugin from GitHub
/plugin marketplace add https://github.com/fuzhibo/qqbot-claudecode-skill
```

### Install from Local

```bash
git clone https://github.com/fuzhibo/qqbot-claudecode-skill.git
cd qqbot-claudecode-skill
npm install
npm run build
claude plugin add $(pwd)
```

### Update Plugin

```bash
# Update from marketplace
claude plugin update qqbot-mcp

# Or update from local
cd /path/to/qqbot-claudecode-skill
git pull
npm install && npm run build
```

---

## Configuration

### Project-Level Configuration

Each project maintains its own QQ Bot credentials, stored in `~/.claude/qqbot-gateway/projects.json`:

```json
{
  "projects": [
    {
      "path": "/path/to/project-a",
      "name": "project-a",
      "botConfig": {
        "appId": "xxx",
        "clientSecret": "xxx"
      }
    },
    {
      "path": "/path/to/project-b",
      "name": "project-b",
      "botConfig": {
        "appId": "yyy",
        "clientSecret": "yyy"
      }
    }
  ]
}
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `QQBOT_APP_ID` | Yes | QQ Bot AppID |
| `QQBOT_CLIENT_SECRET` | Yes | QQ Bot Client Secret |
| `QQBOT_IMAGE_SERVER_BASE_URL` | No | Image server URL |
| `QQBOT_TEST_TARGET_ID` | No | Test target ID (format: `G_群号`, `U_用户ID`, `C_频道ID`) |

### Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| Projects | `~/.claude/qqbot-gateway/projects.json` | Registered projects and bot configs |
| Sessions | `~/.claude/qqbot-gateway/sessions/` | Session data |
| Hooks | `~/.claude/qqbot-gateway/hooks.json` | Hook configurations |
| Logs | `~/.claude/qqbot-gateway/gateway.log` | Gateway logs |
| PID | `~/.claude/qqbot-gateway/gateway.pid` | Process ID file |

---

## Available Commands

### Service Management

| Command | Description |
|---------|-------------|
| `npm run gateway:start` | Start gateway (notify mode) |
| `npm run gateway:start -- --auto` | Start gateway (auto-reply mode) |
| `npm run gateway:stop` | Stop gateway |
| `npm run gateway:status` | View gateway status |
| `npm run doctor` | Run diagnostics |
| `npm run hooks` | Manage hook configurations |

### CLI Commands

```bash
# Register a project
node scripts/qqbot-gateway.js register /path/to/project --name my-project

# Switch default project
node scripts/qqbot-gateway.js switch my-project

# Initialize session
node scripts/qqbot-gateway.js init-session my-project

# Configure hooks
node scripts/qqbot-hooks.js add
node scripts/qqbot-hooks.js list
```

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_active_bots` | Get list of configured bots |
| `send_qq_message` | Send text message to QQ |
| `upload_qq_media` | Upload files/images/videos |
| `fetch_unread_tasks` | Get unread messages |
| `get_qq_context` | Get message history |

---

## QQ Message Communication Guide

### Message Format

When sending messages to QQ, the gateway intelligently parses your input:

#### 1. Project Selection

```
[project-name] Your message here
```
or
```
project:project-name Your message here
```

If no project is specified, the default project is used.

#### 2. Tool Permissions

```
allowedTools: Read, Write, Bash
disallowedTools: WebFetch
```

**Available Tools:**
- **File Operations**: `Read`, `Write`, `Edit`, `NotebookEdit`
- **Network Tools**: `WebFetch`, `WebSearch`
- **Execution Tools**: `Bash`, `Glob`, `Grep`, `BashOutput`, `KillShell`
- **Task Management**: `Task`, `TodoWrite`
- **Others**: `SlashCommand`, `Skill`, `ExitPlanMode`

#### 3. Permission Modes

```
permission-mode: acceptEdits
```

| Mode | Description |
|------|-------------|
| `default` | Manual confirmation for unauthorized operations |
| `acceptEdits` | Auto-approve file edits |
| `bypassPermissions` | Skip all permission checks (use carefully) |
| `plan` | Planning mode only, no execution |

### Example QQ Messages

```
# Simple message (uses default project)
Hello, can you help me fix a bug?

# Specify project
[my-app] Check the authentication module

# With tool permissions
allowedTools: Read, Grep
Search for all TODO comments in the codebase

# With permission mode
permission-mode: acceptEdits
[my-app] Refactor the API handlers

# Combined
[backend] allowedTools: Read, Write, Bash
Update the configuration file with new settings
```

### Response Format

All responses include a project prefix:

```
[project-name] AI response content here...
```

---

## Hook Configuration

Configure hooks to receive QQ notifications when Claude Code events occur.

### Available Hooks

| Hook | Trigger |
|------|---------|
| `SessionStart` | Session begins |
| `SessionEnd` | Session ends |
| `PreToolUse` | Before tool execution |
| `PostToolUse` | After tool execution |
| `UserPromptSubmit` | User submits prompt |
| `PreCompact` | Before context compression |
| `PermissionRequest` | Permission request |

### Template Variables

| Variable | Description |
|----------|-------------|
| `{{project}}` | Project name |
| `{{event}}` | Event name |
| `{{tool}}` | Tool name |
| `{{timestamp}}` | Timestamp |
| `{{cwd}}` | Working directory |

### Configure Hook

```bash
node scripts/qqbot-hooks.js add
```

---

## Skills

### /qqbot-service - Background Service Management

| Command | Description |
|---------|-------------|
| `start [--mode auto/notify]` | Start background service |
| `stop` | Stop background service |
| `restart` | Restart background service |
| `status` | View service status |
| `list` | View project list |
| `switch <name>` | Switch default project |

### /qqbot-set-hook - Hook Configuration

| Command | Description |
|---------|-------------|
| (no args) | Interactive hook configuration |
| `--list` | View configured hooks |
| `--remove <id>` | Remove specified hook |
| `--clear` | Clear all hooks |
| `--test <id>` | Test send hook message |

---

## Troubleshooting

### Run Diagnostics

```bash
npm run doctor
```

### Common Issues

1. **Gateway won't start**
   - Check credentials in project `.env`
   - Verify network connectivity
   - Run `npm run doctor`

2. **Messages not received**
   - Ensure gateway is running: `npm run gateway:status`
   - Check logs: `~/.claude/qqbot-gateway/gateway.log`

3. **Auto-reply not working**
   - Verify project is registered
   - Check `--cwd` path is correct
   - Ensure Claude Code is available

4. **Multiple projects with different bots**
   - Each project should have its own `.env` file
   - Use `register` command to add each project
   - Switch between projects with `switch` command

---

## Version Upgrades

### Automatic Upgrade Handling

The plugin automatically checks for version changes during SessionStart and performs cleanup:

```bash
# Manually trigger upgrade check
npm run upgrade
```

### Automatic Upgrade Actions

| Action | Description |
|--------|-------------|
| Stop Service | Automatically stops running gateway |
| Backup Config | Backs up projects.json, hooks.json, sessions/ |
| Cleanup Sessions | Removes sessions older than 7 days |
| Cleanup Logs | Trims logs exceeding 10MB |
| Migrate Config | Handles config format changes between versions |

### Rollback Operations

```bash
# List available backups
npm run upgrade:backups

# Rollback to specific backup
npm run upgrade:rollback -- backup-2026-03-13T10-30-00-000Z
```

### Handling Upgrade Exceptions

| Scenario | Solution |
|----------|----------|
| Service won't stop | Check PID file, manually kill process |
| Config migration failed | Restore from backup directory |
| Session data lost | Restore from backup-*/sessions/ |
| Permission issues | Check ~/.claude/qqbot-gateway/ directory permissions |

---

## License

MIT License - see [LICENSE](LICENSE)

---

## Original Project

This project is forked from [sliverp/qqbot](https://github.com/sliverp/qqbot). See [README.old.md](README.old.md) for original documentation.
