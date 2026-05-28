# Security

Report security issues privately through the Protoline maintainers rather than
opening a public issue.

This package is intentionally small:

- It has no runtime dependencies.
- It does not store personal access tokens.
- It does not run a local MCP server.
- It only opens the hosted Protoline token page, prints MCP client setup
  commands, optionally runs those client CLIs, and reports local setup state.

Release checks must include:

```sh
npm test
npm audit --omit=dev
npm pack --dry-run
```

Publishing should use npm trusted publishing from CI after the package exists on
npm and the trusted publisher is configured.
