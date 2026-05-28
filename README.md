# @protoline/protoline

Protoline agent setup CLI for the hosted Protoline MCP server.

```sh
npx -y @protoline/protoline login
npx -y @protoline/protoline install --client codex
npx -y @protoline/protoline install --client claude
npx -y @protoline/protoline install --client all
```

The hosted MCP server remains the product contract:

```text
https://app.protoline.ai/api/mcp
```

This package is a setup helper. It does not run a local MCP server and it does
not make skills or slash commands mandatory.

## Commands

Run commands through `npx -y @protoline/protoline <command>`.

- `login`: open the token page and print setup instructions.
- `login --client codex`: install the hosted MCP server and start Codex OAuth.
- `login --client claude`: install the hosted MCP server; Claude Code starts OAuth inside Claude Code.
- `login --manual-token`: open the token page and print PAT fallback setup.
- `install`: add the hosted Protoline MCP server to the selected client config.
- `install --pat`: configure PAT fallback for older clients.
- `install --no-skills`: skip installing local agent skills.
- `install --dry-run`: print the client-specific MCP install commands without running them.
- `doctor`: check common local setup state.

For Codex and Claude, `install` also writes a small local skill:

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

OAuth is the default for hosted HTTP MCP. Personal access tokens remain
available as compatibility fallback for older clients.

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
