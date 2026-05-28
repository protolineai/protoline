# @protoline/protoline

Protoline agent setup CLI for the hosted Protoline MCP server.

```sh
npx -y @protoline/protoline bootstrap
npx -y @protoline/protoline bootstrap --client codex
npx -y @protoline/protoline bootstrap --client claude
npx -y @protoline/protoline bootstrap --client all
npx -y @protoline/protoline login --client codex
```

The hosted MCP server remains the product contract:

```text
https://app.protoline.ai/api/mcp
```

This package is a setup helper. It does not run a local MCP server and it does
not make skills or slash commands mandatory.

## Commands

Run commands through `npx -y @protoline/protoline <command>`.

- `bootstrap`: configure the hosted MCP server and start OAuth where the client exposes a login command.
- `bootstrap --client codex`: configure Codex and start Codex OAuth.
- `bootstrap --client claude`: configure Claude Code; Claude Code starts OAuth inside Claude Code.
- `bootstrap --no-login`: configure the MCP server without starting OAuth.
- `bootstrap --no-skills`: skip installing local agent skills.
- `bootstrap --dry-run`: print the client-specific setup commands without running them.
- `login`: re-run OAuth for an already-configured MCP client.
- `login --client codex`: re-run Codex OAuth without changing MCP server config.
- `login --client claude`: print the Claude Code re-authentication path.
- `doctor`: check common local setup state.

For Codex and Claude, `bootstrap` also writes a small local skill:

```text
$CODEX_HOME/skills/protoline/SKILL.md
$CLAUDE_HOME/skills/protoline/SKILL.md
```

When the home variables are not set, the defaults are `~/.codex` and
`~/.claude`. Restart Codex after installing or updating Codex skills. Restart
Claude Code if the new skill does not appear.

Codex skills are model-invoked context, not `/` commands. In Codex, use
`$protoline` or natural language such as "Show Protoline help." Claude Code may
expose installed skills through `/protoline`.

Skills and client slash commands are optional shortcuts. Protoline still works
through MCP tools when no companion skill is installed.

OAuth is the supported authorization path for hosted HTTP MCP.

## License

Apache-2.0.

## Release checks

Before publishing:

```sh
npm test
npm audit --omit=dev
npm pack --dry-run
```

Releases should be published from the trusted publishing workflow once the npm
package has a trusted publisher configured.
