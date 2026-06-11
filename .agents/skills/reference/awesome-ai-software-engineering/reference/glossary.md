# Glossary

Key terms and definitions for AI-powered software engineering.

---

## A

### Agent
An AI system that can autonomously perform tasks, make decisions, and interact with external systems. Unlike simple chatbots, agents can execute multi-step workflows with minimal human intervention.

### Agent SDK
A software development kit for building AI agents programmatically. Unlike CLI tools for interactive use, SDKs let you embed agent capabilities into your own applications. Examples: Claude Agent SDK, Microsoft Agent Framework.

### Agentic Workflow
A development approach where AI agents handle significant portions of implementation autonomously, guided by specifications and human oversight.

---

## C

### Context Window
The maximum amount of text (measured in tokens) that an AI model can process in a single interaction. Larger context windows allow AI to consider more code and documentation simultaneously.

### Copilot
An AI assistant integrated into an IDE that provides real-time code suggestions, completions, and assistance while you type. Examples: GitHub Copilot, Cursor.

---

## H

### Hooks
Custom scripts or functions that execute at specific points in an AI tool's workflow. In CLI tools, hooks are shell scripts; in Agent SDKs, hooks are programming language functions (Python, TypeScript). Used to validate changes, run tests, log activity, or enforce conventions automatically.

---

## L

### LLM (Large Language Model)
The AI models that power coding assistants. Examples include Claude, GPT-4, and open-source alternatives.

---

## M

### MCP (Model Context Protocol)
An open protocol for connecting AI assistants to external data sources and tools. Enables AI to access databases, APIs, and other systems securely.

### Multi-Agent System
An architecture where multiple specialized AI agents collaborate on complex tasks. Each agent has defined roles, responsibilities, and handoff protocols.

---

## P

### PRD (Product Requirements Document)
A specification document that defines what a feature should do, why it matters, and how success will be measured. Central to spec-driven development.

### PRD Loop
A cyclic workflow: Specify (write PRD) → Plan (AI creates tasks) → Execute (AI implements) → Review (human validates) → Refine (update PRD). Repeat until complete.

### Prompt
The text instruction given to an AI model. In coding contexts, this includes the request, relevant code, and context needed for the AI to help effectively.

### Prompt Engineering
The practice of crafting effective prompts to get better results from AI models. Includes techniques for providing context, constraints, and examples.

---

## R

### RAG (Retrieval-Augmented Generation)
A technique where AI retrieves relevant documents before generating responses. Helps AI tools access current codebase information beyond their training data.

---

## S

### Skills
Reusable capabilities or extensions for AI coding tools. Can include custom prompts, tool integrations, or workflow automations.

### Spec-Driven Development
A methodology where specifications are written before code. The spec serves as the primary input for AI code generation and the benchmark for review.

### Specification (Spec)
A document describing what should be built, including requirements, constraints, and acceptance criteria. Can be formal (PRD) or informal (task description).

### Session
In agent SDKs, a session maintains context (conversation history, tool results, working state) across multiple queries. Sessions enable follow-up queries that build on previous interactions without losing context.

### Subagent
A secondary AI agent spawned by a primary agent to handle specific subtasks. Subagents can work in parallel on different aspects of a complex task, then report results back to the main agent.

---

## T

### Token
The basic unit of text that AI models process. Roughly 4 characters or 0.75 words in English. Token limits affect how much code an AI can consider at once.

### Tool Use
The ability of AI agents to invoke external tools like file operations, web searches, or API calls. Enables agents to take actions beyond generating text.

---

## W

### Workflow
A defined sequence of steps for accomplishing a task. In AI coding, often refers to patterns like the PRD loop or spec-driven development process.

---

## Common Abbreviations

| Abbreviation | Meaning |
|--------------|---------|
| AI | Artificial Intelligence |
| API | Application Programming Interface |
| CLI | Command Line Interface |
| IDE | Integrated Development Environment |
| LLM | Large Language Model |
| MCP | Model Context Protocol |
| PRD | Product Requirements Document |
| RAG | Retrieval-Augmented Generation |
| SDK | Software Development Kit |

---

*Missing a term? Submit a PR to add it.*
