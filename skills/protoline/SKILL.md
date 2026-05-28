---
name: protoline
description: Use when the user asks to work with Protoline projects, MCP tools, change requests, deployments, logs, project creation, publishing, promotion, or invokes Protoline shortcuts such as /protoline, /protoline new, /protoline publish, /protoline promote, or $protoline.
metadata:
  short-description: Work with Protoline MCP
argument-hint: "[new|publish|promote|login]"
---

# Protoline

Use the configured Protoline MCP server as the source of truth.

If no Protoline MCP tools are available, tell the user to run:

```sh
npx -y @protoline/protoline install --client all
```

## Shortcuts

Invocation arguments: $ARGUMENTS

- Empty Protoline invocation, `/protoline`, or `$protoline`: call `protoline_help`.
- `new`: create a new project. Use `list_organizations` and `list_teams` first if the target organization or team is ambiguous, then call `create_project`.
- `publish` or `promote`: publish the reviewed change to production. Resolve the project and change request, then call `publish_change` or `promote_change`; they are aliases for the same production workflow.
- `login`: explain that token setup is handled by `npx -y @protoline/protoline login`.

For status, files, diffs, activity, logs, retries, and change requests, use natural language and the available MCP tool descriptions rather than inventing extra slash commands.

The skill is only a convenience layer. Protoline must still work through MCP tools if this skill is removed.
