# @protoline/protoline

Protoline agent setup CLI for the hosted Protoline MCP server.

```sh
npx -y @protoline/protoline login
export PROTOLINE_MCP_TOKEN="plpat_..."
npx -y @protoline/protoline install --client codex
npx -y @protoline/protoline install --client claude
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
- `login --no-open`: print setup instructions without opening a browser.
- `install`: add the hosted Protoline MCP server to the selected client config.
- `install --dry-run`: print the client-specific MCP install commands without running them.
- `doctor`: check common local setup state.

Skills and client slash commands are optional. Protoline still works through MCP
tools when no companion skill is installed.

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
