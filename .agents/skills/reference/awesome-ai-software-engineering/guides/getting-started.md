# Getting Started with AI-Powered Development

This guide will help you take your first steps with AI coding tools and establish an effective workflow.

## Prerequisites

- Basic programming experience in any language
- Familiarity with git and command line
- An API key or subscription to an AI service (Claude, OpenAI, etc.)

## Step 1: Choose Your First Tool

### For Beginners

Start with an IDE-integrated copilot:

| If you prefer... | Try this |
|-----------------|----------|
| VSCode | [Cursor](https://cursor.sh) or [Continue](https://github.com/continuedev/continue) |
| JetBrains IDEs | [GitHub Copilot](https://github.com/features/copilot) |
| Terminal-first | [Claude Code](https://github.com/anthropics/claude-code) |

### For Experienced Developers

Consider an autonomous agent:

| If you want... | Try this |
|---------------|----------|
| Full autonomy | [Claude Code](https://github.com/anthropics/claude-code) |
| Git integration | [Aider](https://github.com/paul-gauthier/aider) |
| Maximum control | [OpenCode](https://github.com/anomalyco/opencode) |

### For Building Custom Agents

Embed AI agents in your applications:

| If you want... | Try this |
|----------------|----------|
| Python integration | [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) (`uv add claude-code-sdk`) |
| TypeScript/Node.js | [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) (`npm i @anthropic-ai/claude-code-sdk`) |
| .NET ecosystem | [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) |

See our [Agent SDK Guide](agent-sdk-guide.md) for detailed usage.

## Step 2: Your First AI-Assisted Task

### The Basic Workflow

```
Specify → Plan → Execute → Review → Commit
```

### Example: Adding a Feature

Let's walk through adding a simple feature using this workflow.

#### 1. Write a Brief Spec

Create a file called `TASK.md`:

```markdown
# Feature: Add user greeting

## What
Display a personalized greeting when users log in.

## Requirements
- Show "Welcome back, {name}!" for returning users
- Show "Welcome, {name}!" for new users
- Display in the header component

## Acceptance Criteria
- [ ] Greeting appears within 1 second of login
- [ ] Works for both new and returning users
- [ ] Gracefully handles missing name (use "there")
```

#### 2. Ask AI to Plan

Prompt your AI tool:

```
Read TASK.md and create an implementation plan.
List the files that need to change and what changes each needs.
```

Review the plan before proceeding.

#### 3. Execute with AI

Once the plan looks good:

```
Implement the plan. Make the changes to each file.
```

#### 4. Review the Changes

- Read through each change
- Run the tests
- Try it manually
- Ask AI to explain anything unclear

#### 5. Commit

```
Create a commit with a clear message describing this feature.
```

## Step 3: Build Your Workflow

### Create Your Context File

Most AI tools work better with context. Create a `CONTEXT.md`:

```markdown
# Project Context

## Overview
Brief description of your project.

## Architecture
- Frontend: React
- Backend: Node.js
- Database: PostgreSQL

## Conventions
- Use TypeScript
- Follow existing code style
- Write tests for new features

## Current Focus
What you're working on right now.
```

### Establish Your Spec Templates

Use the templates in [patterns/spec-templates/](../patterns/spec-templates/) as starting points:

- [PRD.md.template](../patterns/spec-templates/PRD.md.template) - For features
- [CONTEXT.md.template](../patterns/spec-templates/CONTEXT.md.template) - For project state

### Common Patterns

#### Bug Fixing

```
I'm seeing [error].
Here's the stack trace: [paste]
Here's the relevant code: [paste or file path]
Find and fix the root cause.
```

#### Code Review

```
Review this code for:
- Potential bugs
- Performance issues
- Security concerns
- Style consistency
```

#### Refactoring

```
Refactor [file/function] to:
- [Specific improvement]
- Maintain existing behavior
- Keep the same public interface
```

## Tips for Success

### Do

- **Be specific** - Vague prompts get vague results
- **Provide context** - The more the AI knows, the better it can help
- **Review everything** - AI makes mistakes; you're still responsible
- **Iterate** - First result often isn't final; refine it
- **Learn from outputs** - Study what AI generates to improve your prompts

### Don't

- **Trust blindly** - Always review AI-generated code
- **Skip testing** - AI code needs tests like any other code
- **Ignore warnings** - If AI says something might be risky, listen
- **Over-rely** - Keep your own skills sharp
- **Rush** - Taking time to write good specs saves time overall

## Common Issues

### AI Doesn't Understand the Codebase

- Provide more context files
- Point to specific relevant files
- Explain project conventions

### Output is Too Generic

- Add constraints to your prompt
- Provide examples of what you want
- Ask for specific implementation details

### Changes Break Things

- Ask AI to run tests before committing
- Request smaller, incremental changes
- Have AI explain its changes

## Next Steps

1. Read [Spec-Driven Development](spec-driven-development.md) for advanced workflows
2. Explore [Choosing Your Tools](choosing-your-tools.md) to expand your toolkit
3. Check out the [Glossary](../reference/glossary.md) for terminology

---

*Remember: AI is a powerful tool, but you're still the engineer. Use it to amplify your abilities, not replace your judgment.*
