# Spec-Driven Development

Spec-driven development is the practice of writing clear specifications before asking AI to generate code. This guide covers why it works and how to do it effectively.

## Why Specs Matter

### The Problem with "Just Code It"

When you ask AI to "build a login page," you might get:
- A basic HTML form with no styling
- A full React component with OAuth integration
- Something in between that doesn't match your stack

The AI has to guess your intent, architecture, and constraints.

### The Spec Solution

A good spec removes guesswork:

```markdown
# Login Page

## Context
- React 18 + TypeScript project
- Using Tailwind CSS
- Auth via existing /api/auth endpoint

## Requirements
- Email and password fields
- "Remember me" checkbox
- "Forgot password" link
- Submit button with loading state

## Constraints
- Match existing component patterns in src/components/
- Use existing Button component
- Form validation before submission
```

Now the AI has everything it needs.

## The PRD Loop

The PRD (Product Requirements Document) loop is a cyclic process:

```
┌─────────────┐
│   Specify   │
│  (Write PRD)│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Plan     │
│ (AI breaks  │
│  into tasks)│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Execute   │
│ (AI writes  │
│    code)    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Review    │
│  (You check │
│   results)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Refine    │◄─── Repeat until done
│(Update PRD) │
└─────────────┘
```

### 1. Specify

Write a PRD using the [PRD template](../patterns/spec-templates/PRD.md.template):

- What are you building?
- Why does it matter?
- What are the constraints?
- What does success look like?

### 2. Plan

Ask AI to create an implementation plan:

```
Read the PRD and create a detailed implementation plan.
Break it into specific tasks with file changes.
Identify any questions or ambiguities.
```

Review the plan. Clarify anything unclear.

### 3. Execute

Work through the plan task by task:

```
Implement task 1: [description]
```

For larger tasks, ask for checkpoints:

```
Implement the first half, then pause for review.
```

### 4. Review

After each task:
- Read the generated code
- Run tests
- Try it manually
- Note any issues

### 5. Refine

Update the PRD based on what you learned:
- Requirements that changed
- Edge cases discovered
- Scope adjustments

Then continue the loop.

## Writing Good Specs

### Structure

A good spec has:

1. **Context** - What exists, what stack, what patterns
2. **Requirements** - What it must do
3. **Constraints** - What limits apply
4. **Non-goals** - What it explicitly shouldn't do
5. **Acceptance criteria** - How to verify success

### Example: Bad vs Good

**Bad spec:**
```
Build a notification system.
```

**Good spec:**
```markdown
# Notification System

## Context
- Node.js backend with Express
- PostgreSQL database
- Existing User model in src/models/user.ts

## Requirements
- Store notifications in database
- Mark as read/unread
- API endpoints: list, mark read, delete
- Support notification types: info, warning, error

## Constraints
- Max 100 notifications per user (auto-delete oldest)
- Must work with existing auth middleware
- Follow existing API patterns in src/routes/

## Non-goals
- Real-time push (future phase)
- Email notifications (separate system)
- Notification preferences

## Acceptance Criteria
- [ ] Can create notification via internal service
- [ ] API returns paginated list
- [ ] Mark as read updates timestamp
- [ ] Old notifications auto-deleted
```

## Tools for Spec-Driven Development

| Tool | Approach |
|------|----------|
| [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) | Comprehensive spec framework |
| [Shotgun](https://github.com/shotgun-sh/shotgun) | Spec-based generation |
| [OpenSpec](https://github.com/Fission-AI/OpenSpec) | Open spec standard |
| [Spec-Kit](https://github.com/github/spec-kit) | Spec management toolkit |

## Tips

### Start Small

Don't spec the entire system at once. Break it down:
- One feature at a time
- Clear boundaries between specs
- Reference other specs as needed

### Keep Specs Updated

Treat specs as living documents:
- Update when requirements change
- Note what actually got built
- Archive completed specs

### Use Templates

The [patterns/spec-templates/](../patterns/spec-templates/) directory has templates:
- [PRD.md.template](../patterns/spec-templates/PRD.md.template) - Features
- [AGENTS.md.template](../patterns/spec-templates/AGENTS.md.template) - Multi-agent config
- [CONTEXT.md.template](../patterns/spec-templates/CONTEXT.md.template) - Project state

---

*Good specs take time upfront but save time overall. The AI becomes dramatically more effective when it knows exactly what you want.*
