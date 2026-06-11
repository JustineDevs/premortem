# Patterns

Reusable templates and patterns for AI-powered software engineering.

## Available Templates

### Spec Templates

Located in [spec-templates/](spec-templates/):

| Template | Purpose |
|----------|---------|
| [PRD.md.template](spec-templates/PRD.md.template) | Product Requirements Document for features |
| [AGENTS.md.template](spec-templates/AGENTS.md.template) | Multi-agent configuration and roles |
| [CONTEXT.md.template](spec-templates/CONTEXT.md.template) | Project state and context tracking |

## How to Use Templates

### Option 1: Copy and Customize

```bash
cp patterns/spec-templates/PRD.md.template docs/PRD-feature-name.md
```

Then edit to match your needs.

### Option 2: Reference Pattern

Tell your AI tool:

```
Use the PRD template from patterns/spec-templates/PRD.md.template
to create a PRD for [your feature].
```

### Option 3: Build Your Own

Use these as inspiration to create templates that fit your workflow.

## Template Philosophy

Good templates:
- **Guide thinking** - Sections prompt you to consider important aspects
- **Stay flexible** - Not every section applies to every situation
- **Evolve** - Update templates based on what works

## Contributing Templates

Have a useful template? See [CONTRIBUTING.md](../CONTRIBUTING.md) for how to add it.

Potential additions:
- API specification templates
- Test plan templates
- Architecture decision records
- Migration plan templates
