# MCP Templates

These files are concrete starting points for configuring GitLab MCP and Google's MCP Toolbox in tools that understand the standard `mcpServers` JSON shape.

Use cases:

- local AI client configuration
- GitLab Duo CLI / IDE integration
- Postgres database tooling through MCP Toolbox
- shared template for future automation

Notes:

- replace hostnames, tokens, and prefixes before using in a real environment
- keep secrets out of committed templates
- prefer the official GitLab MCP server endpoint over unofficial community servers for production use
- use the official MCP Toolbox server package (`@toolbox-sdk/server`) for database access and keep connection secrets in local environment variables
