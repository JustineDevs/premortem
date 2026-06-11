# Claude Agent SDK Guide

Build production AI agents programmatically using Claude Code as a library.

## What is Claude Agent SDK?

The Claude Agent SDK lets you embed Claude Code's capabilities into your own applications. Instead of using the CLI interactively, you can programmatically control AI agents that read files, write code, execute commands, and interact with external systems.

### SDK vs CLI vs Client SDK

| Tool | Purpose | When to Use |
|------|---------|-------------|
| **Claude Code CLI** | Interactive terminal agent | Manual development tasks |
| **Claude Agent SDK** | Embedded agent library | Custom applications, automation |
| **Claude Client SDK** | Raw API access | Simple completions, no tools |

The Agent SDK provides the full power of Claude Code (tools, sessions, hooks) as an importable library.

---

## Installation

### Python

```bash
# Using uv (recommended)
uv add claude-code-sdk

# Or pip
pip install claude-code-sdk
```

### TypeScript/Node.js

```bash
npm install @anthropic-ai/claude-code-sdk
```

---

## Input Modes

The SDK supports two distinct input modes for interacting with agents.

### Streaming Input Mode (Recommended)

Streaming mode provides full access to the agent's capabilities with a persistent, interactive session:

```python
from claude_agent_sdk import query, ClaudeAgentOptions
import asyncio

async def streaming_example():
    async def message_generator():
        yield {
            "type": "user",
            "message": {
                "role": "user",
                "content": "Analyze this codebase for security issues"
            }
        }

        await asyncio.sleep(2)

        yield {
            "type": "user",
            "message": {
                "role": "user",
                "content": "Now fix the most critical issue"
            }
        }

    async for message in query(
        prompt=message_generator(),
        options=ClaudeAgentOptions(
            max_turns=10,
            allowed_tools=["Read", "Grep", "Edit"]
        )
    ):
        if hasattr(message, 'result'):
            print(message.result)
```

**Benefits of streaming mode:**
- Image uploads in messages
- Queued messages with ability to interrupt
- Full tool and MCP server access
- Hook support for lifecycle events
- Real-time streaming responses
- Natural multi-turn conversations

### Single Message Input

Simpler but more limited, use for one-shot responses:

```python
from claude_agent_sdk import query, ClaudeAgentOptions

async for message in query(
    prompt="Explain the authentication flow",
    options=ClaudeAgentOptions(max_turns=1)
):
    if hasattr(message, 'result'):
        print(message.result)
```

---

## Sessions

Sessions maintain context across multiple queries, enabling follow-up queries that build on previous interactions.

### Getting and Using Session IDs

```python
from claude_agent_sdk import query, ClaudeAgentOptions

session_id = None

# First query - capture session ID
async for message in query(
    prompt="Help me build a web application",
    options=ClaudeAgentOptions(model="claude-sonnet-4-5")
):
    if hasattr(message, 'subtype') and message.subtype == 'init':
        session_id = message.data.get('session_id')
        print(f"Session started: {session_id}")

    if hasattr(message, 'result'):
        print(message.result)

# Resume session for follow-up
if session_id:
    async for message in query(
        prompt="Continue where we left off",
        options=ClaudeAgentOptions(resume=session_id)
    ):
        if hasattr(message, 'result'):
            print(message.result)
```

### Forking Sessions

Fork a session to explore different approaches from the same starting point:

```python
# Fork to try a different approach (original session unchanged)
async for message in query(
    prompt="Now let's redesign this as a GraphQL API instead",
    options=ClaudeAgentOptions(
        resume=session_id,
        fork_session=True  # Creates new session ID
    )
):
    print(message)
```

---

## Permissions

Control how your agent uses tools with permission modes and rules.

### Permission Modes

| Mode | Description |
|------|-------------|
| `default` | Standard behavior; unmatched tools trigger `canUseTool` callback |
| `acceptEdits` | Auto-approve file edits and filesystem operations |
| `bypassPermissions` | Bypass all permission checks (use with caution) |
| `plan` | Planning mode; Claude plans without making changes |

```python
from claude_agent_sdk import query, ClaudeAgentOptions

async for message in query(
    prompt="Help me refactor this code",
    options=ClaudeAgentOptions(
        permission_mode="acceptEdits"
    )
):
    print(message)
```

### Dynamic Permission Changes

Change permissions mid-session:

```python
q = query(
    prompt="Help me refactor this code",
    options=ClaudeAgentOptions(permission_mode="default")
)

# Later, loosen permissions
await q.set_permission_mode("acceptEdits")

async for message in q:
    print(message)
```

---

## User Input and Approvals

Handle tool approval requests and clarifying questions from Claude.

### Handling Tool Approvals

```python
from claude_agent_sdk import query, ClaudeAgentOptions
from claude_agent_sdk.types import PermissionResultAllow, PermissionResultDeny

async def can_use_tool(tool_name, input_data, context):
    print(f"Tool: {tool_name}")

    if tool_name == "Bash":
        print(f"Command: {input_data.get('command')}")

    response = input("Allow this action? (y/n): ")

    if response.lower() == "y":
        return PermissionResultAllow(updated_input=input_data)
    else:
        return PermissionResultDeny(message="User denied this action")

async for message in query(
    prompt="Create and delete a test file",
    options=ClaudeAgentOptions(can_use_tool=can_use_tool)
):
    if hasattr(message, 'result'):
        print(message.result)
```

### Handling Clarifying Questions

Claude uses `AskUserQuestion` when it needs more information:

```python
async def can_use_tool(tool_name, input_data, context):
    if tool_name == "AskUserQuestion":
        answers = {}
        for q in input_data.get("questions", []):
            print(f"\n{q['header']}: {q['question']}")
            for i, opt in enumerate(q["options"]):
                print(f"  {i + 1}. {opt['label']} - {opt['description']}")

            response = input("Your choice: ")
            # Map response to answer
            answers[q["question"]] = q["options"][int(response) - 1]["label"]

        return PermissionResultAllow(
            updated_input={"questions": input_data["questions"], "answers": answers}
        )

    return PermissionResultAllow(updated_input=input_data)
```

---

## Hooks

Intercept agent execution at key points for validation, logging, security, or custom logic.

### Available Hooks

| Hook Event | Description |
|------------|-------------|
| `PreToolUse` | Before tool execution (can block or modify) |
| `PostToolUse` | After tool execution result |
| `UserPromptSubmit` | User prompt submission |
| `Stop` | Agent execution stop |
| `SubagentStop` | Subagent completion |
| `PreCompact` | Before conversation compaction |

### Example: Block Dangerous Commands

```python
from claude_agent_sdk import query, ClaudeAgentOptions, HookMatcher

async def block_dangerous(input_data, tool_use_id, context):
    command = input_data['tool_input'].get('command', '')

    if 'rm -rf /' in command:
        return {
            'hookSpecificOutput': {
                'hookEventName': input_data['hook_event_name'],
                'permissionDecision': 'deny',
                'permissionDecisionReason': 'Dangerous command blocked'
            }
        }
    return {}

async for message in query(
    prompt="Help me clean up the project",
    options=ClaudeAgentOptions(
        hooks={
            'PreToolUse': [HookMatcher(matcher='Bash', hooks=[block_dangerous])]
        }
    )
):
    print(message)
```

### Example: Audit Logging

```python
async def audit_logger(input_data, tool_use_id, context):
    print(f"[AUDIT] Tool: {input_data['tool_name']}")
    print(f"[AUDIT] Input: {input_data['tool_input']}")
    return {}

options = ClaudeAgentOptions(
    hooks={
        'PreToolUse': [HookMatcher(hooks=[audit_logger])]  # No matcher = all tools
    }
)
```

### Example: Redirect to Sandbox

```python
async def redirect_to_sandbox(input_data, tool_use_id, context):
    if input_data['tool_name'] == 'Write':
        original_path = input_data['tool_input'].get('file_path', '')
        return {
            'hookSpecificOutput': {
                'hookEventName': input_data['hook_event_name'],
                'permissionDecision': 'allow',
                'updatedInput': {
                    **input_data['tool_input'],
                    'file_path': f'/sandbox{original_path}'
                }
            }
        }
    return {}
```

---

## Subagents

Spawn separate agent instances for focused subtasks with isolated context.

### Benefits
- **Context isolation** - Subagents don't pollute main conversation
- **Parallelization** - Multiple subagents can run concurrently
- **Specialized instructions** - Tailored system prompts per subagent
- **Tool restrictions** - Limit subagent capabilities

### Defining Subagents

```python
from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition

async for message in query(
    prompt="Review the authentication module for security issues",
    options=ClaudeAgentOptions(
        allowed_tools=["Read", "Grep", "Glob", "Task"],  # Task required for subagents
        agents={
            "code-reviewer": AgentDefinition(
                description="Expert code review specialist. Use for security reviews.",
                prompt="""You are a code review specialist with expertise in security.
When reviewing code:
- Identify security vulnerabilities
- Check for performance issues
- Suggest specific improvements""",
                tools=["Read", "Grep", "Glob"],  # Read-only
                model="sonnet"
            ),
            "test-runner": AgentDefinition(
                description="Runs and analyzes test suites.",
                prompt="Run tests and analyze results.",
                tools=["Bash", "Read", "Grep"]
            )
        }
    )
):
    if hasattr(message, 'result'):
        print(message.result)
```

---

## MCP Integration

Connect to MCP (Model Context Protocol) servers for external tools and data sources.

### Configuring MCP Servers

```python
from claude_agent_sdk import query, ClaudeAgentOptions
import os

options = ClaudeAgentOptions(
    mcp_servers={
        "github": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-github"],
            "env": {"GITHUB_TOKEN": os.environ["GITHUB_TOKEN"]}
        },
        "postgres": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-postgres", os.environ["DATABASE_URL"]]
        }
    },
    allowed_tools=["mcp__github__*", "mcp__postgres__query"]  # Wildcards supported
)

async for message in query(
    prompt="List recent issues and check if any touch the users table",
    options=options
):
    if hasattr(message, 'result'):
        print(message.result)
```

### HTTP/SSE Servers

```python
options = ClaudeAgentOptions(
    mcp_servers={
        "docs": {
            "type": "http",
            "url": "https://code.claude.com/docs/mcp"
        }
    },
    allowed_tools=["mcp__docs__*"]
)
```

---

## Custom Tools

Define your own tools using in-process MCP servers.

```python
from claude_agent_sdk import tool, create_sdk_mcp_server, query, ClaudeAgentOptions
import aiohttp

@tool("get_weather", "Get current temperature for a location", {"latitude": float, "longitude": float})
async def get_weather(args):
    async with aiohttp.ClientSession() as session:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={args['latitude']}&longitude={args['longitude']}&current=temperature_2m"
        async with session.get(url) as response:
            data = await response.json()

    return {
        "content": [{
            "type": "text",
            "text": f"Temperature: {data['current']['temperature_2m']}°C"
        }]
    }

custom_server = create_sdk_mcp_server(
    name="weather-tools",
    version="1.0.0",
    tools=[get_weather]
)

# Use streaming input for custom tools
async def message_generator():
    yield {"type": "user", "message": {"role": "user", "content": "What's the weather in Paris?"}}

async for message in query(
    prompt=message_generator(),
    options=ClaudeAgentOptions(
        mcp_servers={"weather-tools": custom_server},
        allowed_tools=["mcp__weather-tools__get_weather"]
    )
):
    if hasattr(message, 'result'):
        print(message.result)
```

---

## Structured Outputs

Get validated JSON matching a schema instead of free-form text.

### Using JSON Schema

```python
from claude_agent_sdk import query, ClaudeAgentOptions

schema = {
    "type": "object",
    "properties": {
        "company_name": {"type": "string"},
        "founded_year": {"type": "number"},
        "headquarters": {"type": "string"}
    },
    "required": ["company_name"]
}

async for message in query(
    prompt="Research Anthropic and provide key company information",
    options=ClaudeAgentOptions(
        output_format={"type": "json_schema", "schema": schema}
    )
):
    if hasattr(message, 'structured_output'):
        print(message.structured_output)
        # {'company_name': 'Anthropic', 'founded_year': 2021, ...}
```

### Using Pydantic (Type-Safe)

```python
from pydantic import BaseModel
from claude_agent_sdk import query, ClaudeAgentOptions

class Step(BaseModel):
    step_number: int
    description: str
    complexity: str

class FeaturePlan(BaseModel):
    feature_name: str
    summary: str
    steps: list[Step]
    risks: list[str]

async for message in query(
    prompt="Plan how to add dark mode support to a React app",
    options=ClaudeAgentOptions(
        output_format={
            "type": "json_schema",
            "schema": FeaturePlan.model_json_schema()
        }
    )
):
    if hasattr(message, 'structured_output'):
        plan = FeaturePlan.model_validate(message.structured_output)
        print(f"Feature: {plan.feature_name}")
        for step in plan.steps:
            print(f"  {step.step_number}. [{step.complexity}] {step.description}")
```

---

## Cost Tracking

Track token usage and costs for billing.

```python
from claude_agent_sdk import query, AssistantMessage, ResultMessage

class CostTracker:
    def __init__(self):
        self.processed_ids = set()
        self.step_usages = []

    async def track(self, prompt):
        async for message in query(prompt=prompt):
            if isinstance(message, AssistantMessage) and hasattr(message, 'usage'):
                msg_id = getattr(message, 'id', None)
                if msg_id and msg_id not in self.processed_ids:
                    self.processed_ids.add(msg_id)
                    self.step_usages.append({
                        "message_id": msg_id,
                        "usage": message.usage
                    })

            if isinstance(message, ResultMessage):
                return {
                    "result": message,
                    "total_cost": message.total_cost_usd,
                    "steps": len(self.step_usages)
                }

tracker = CostTracker()
result = await tracker.track("Analyze this codebase")
print(f"Total cost: ${result['total_cost']:.4f}")
```

**Key rules:**
- Messages with the same `id` report identical usage (charge once per step)
- The final `result` message contains cumulative usage and `total_cost_usd`
- Use `modelUsage` for per-model breakdown when using multiple models

---

## Built-in Tools

The Agent SDK includes Claude Code's full tool suite:

| Tool | Description |
|------|-------------|
| `Read` | Read files from the filesystem |
| `Write` | Create or overwrite files |
| `Edit` | Make precise edits to existing files |
| `Bash` | Execute shell commands |
| `Glob` | Find files matching patterns |
| `Grep` | Search file contents with regex |
| `WebSearch` | Search the web |
| `WebFetch` | Fetch and process web content |
| `AskUserQuestion` | Request input from users |
| `Task` | Spawn subagents |

---

## Best Practices

### 1. Use Sessions for Related Tasks

```python
# Good: Related queries share context
agent = Agent()
await agent.query("Read the user model")
await agent.query("Add email validation")  # Knows about user model

# Bad: New session loses context
await query("Read the user model")
await query("Add email validation")  # Doesn't know about user model
```

### 2. Set Appropriate Permissions

```python
# Production: Restrict to necessary tools
options = ClaudeAgentOptions(
    allowed_tools=["Read", "Grep", "Glob"],  # Read-only
    permission_mode="default"
)

# Development: More permissive
options = ClaudeAgentOptions(permission_mode="acceptEdits")
```

### 3. Use Hooks for Observability

```python
import logging

async def log_hook(input_data, tool_use_id, context):
    logging.info(f"Tool {input_data['tool_name']}: {input_data['tool_input']}")
    return {}

options = ClaudeAgentOptions(
    hooks={'PreToolUse': [HookMatcher(hooks=[log_hook])]}
)
```

### 4. Handle Errors Gracefully

```python
async for message in query(prompt="Complex task"):
    if hasattr(message, 'subtype'):
        if message.subtype == 'error_during_execution':
            print("Agent encountered an error")
        elif message.subtype == 'error_max_structured_output_retries':
            print("Could not produce valid structured output")
```

---

## Comparison: CLI vs SDK

| Feature | Claude Code CLI | Claude Agent SDK |
|---------|-----------------|------------------|
| Interface | Interactive terminal | Programmatic API |
| Session control | Automatic | Manual via options |
| Tool access | All built-in | All built-in + custom |
| Hooks | Shell scripts | Python/TS functions |
| Permissions | Config file | Code configuration |
| MCP servers | Config file | Code configuration |
| User input | Terminal prompts | Custom callbacks |
| Structured output | N/A | JSON schema support |
| Cost tracking | Built-in display | Programmatic access |
| Use case | Manual development | Automation, apps |

---

## Official Documentation

For complete API reference and additional topics:

- [SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Streaming vs Single Mode](https://platform.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)
- [Permissions](https://platform.claude.com/docs/en/agent-sdk/permissions)
- [User Input & Approvals](https://platform.claude.com/docs/en/agent-sdk/user-input)
- [Hooks](https://platform.claude.com/docs/en/agent-sdk/hooks)
- [Sessions](https://platform.claude.com/docs/en/agent-sdk/sessions)
- [MCP Integration](https://platform.claude.com/docs/en/agent-sdk/mcp)
- [Custom Tools](https://platform.claude.com/docs/en/agent-sdk/custom-tools)
- [Subagents](https://platform.claude.com/docs/en/agent-sdk/subagents)
- [Structured Outputs](https://platform.claude.com/docs/en/agent-sdk/structured-outputs)
- [Cost Tracking](https://platform.claude.com/docs/en/agent-sdk/cost-tracking)
- [File Checkpointing](https://platform.claude.com/docs/en/agent-sdk/file-checkpointing)
- [Hosting](https://platform.claude.com/docs/en/agent-sdk/hosting)
- [Secure Deployment](https://platform.claude.com/docs/en/agent-sdk/secure-deployment)
- [System Prompts](https://platform.claude.com/docs/en/agent-sdk/modifying-system-prompts)
- [Slash Commands](https://platform.claude.com/docs/en/agent-sdk/slash-commands)
- [Skills](https://platform.claude.com/docs/en/agent-sdk/skills)
- [TODO Tracking](https://platform.claude.com/docs/en/agent-sdk/todo-tracking)
- [Plugins](https://platform.claude.com/docs/en/agent-sdk/plugins)

---

## Related Guides

- [Getting Started](getting-started.md) - Basic AI coding workflow
- [Choosing Your Tools](choosing-your-tools.md) - Tool selection guide
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP specification

---

*Build production-grade AI agents that work the way you need them to.*
