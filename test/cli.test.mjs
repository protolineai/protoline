import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_INVOCATION,
  DEFAULT_MCP_URL,
  buildInstallCommands,
  doctorReport,
  executionArgs,
  isEntrypointPath,
  loginMessage,
  parseArgs,
  redactSecrets,
  run,
  tokenSetupLines
} from "../bin/protoline.mjs";

test("builds Codex and Claude install commands", () => {
  const commands = buildInstallCommands({
    client: "all",
    mcpUrl: DEFAULT_MCP_URL,
    tokenEnv: "PROTOLINE_MCP_TOKEN"
  });

  assert.deepEqual(
    commands.map((command) => command.client),
    ["codex", "claude"]
  );
  assert.equal(commands[0].command, "codex");
  assert.ok(commands[0].args.includes("--bearer-token-env-var"));
  assert.equal(commands[1].command, "claude");
  assert.ok(commands[1].args.includes("Authorization: Bearer $PROTOLINE_MCP_TOKEN"));
});

test("parses install options", () => {
  const options = parseArgs([
    "install",
    "--client",
    "codex",
    "--execute",
    "--token-env",
    "TOKEN",
    "--url",
    "https://example.test/mcp"
  ]);

  assert.equal(options.command, "install");
  assert.equal(options.client, "codex");
  assert.equal(options.execute, true);
  assert.equal(options.dryRun, false);
  assert.equal(options.tokenEnv, "TOKEN");
  assert.equal(options.mcpUrl, "https://example.test/mcp");
});

test("install executes by default and supports dry run", () => {
  assert.equal(parseArgs(["install"]).execute, true);

  const options = parseArgs(["install", "--dry-run"]);
  assert.equal(options.execute, false);
  assert.equal(options.dryRun, true);
});

test("login opens the browser by default and supports no-open", () => {
  assert.equal(parseArgs(["login"]).open, true);
  assert.equal(parseArgs(["login", "--no-open"]).open, false);
});

test("login message points users to token creation without storing secrets", () => {
  const text = loginMessage({
    tokenUrl: "https://example.test/tokens",
    tokenEnv: "TOKEN"
  });

  assert.match(text, /https:\/\/example\.test\/tokens/);
  assert.match(text, /export TOKEN="plpat_\.\.\."/);
  assert.ok(text.includes(`${DEFAULT_INVOCATION} install --client codex`));
  assert.ok(text.includes(`${DEFAULT_INVOCATION} install --client claude`));
  assert.doesNotMatch(text, /\n  protoline install --client/);
});

test("install setup message reflects exported token state", () => {
  assert.deepEqual(tokenSetupLines({ tokenEnv: "TOKEN" }, { TOKEN: "plpat_test" }), [
    "TOKEN is set."
  ]);

  assert.deepEqual(tokenSetupLines({ tokenEnv: "TOKEN" }, {}), [
    "Set TOKEN before adding Protoline MCP:",
    "  export TOKEN=\"plpat_...\"",
    "If you already set it, make sure it is exported in this shell."
  ]);
});

test("install dry run prints commands without executing them", () => {
  const result = run(
    parseArgs([
      "install",
      "--client",
      "codex",
      "--dry-run",
      "--token-env",
      "TOKEN",
      "--url",
      "https://example.test/mcp"
    ])
  );

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Set TOKEN before adding Protoline MCP:/);
  assert.match(
    result.stdout,
    /codex mcp add protoline --url https:\/\/example\.test\/mcp --bearer-token-env-var TOKEN/
  );
  assert.match(result.stdout, /Run without --dry-run to install from this CLI\./);
});

test("install dry run reports exported token state", () => {
  const previous = process.env.TOKEN;
  process.env.TOKEN = "plpat_test";

  try {
    const result = run(
      parseArgs(["install", "--client", "codex", "--dry-run", "--token-env", "TOKEN"])
    );

    assert.equal(result.code, 0);
    assert.match(result.stdout, /TOKEN is set\./);
    assert.doesNotMatch(result.stdout, /export TOKEN=/);
  } finally {
    if (previous === undefined) {
      delete process.env.TOKEN;
    } else {
      process.env.TOKEN = previous;
    }
  }
});

test("doctor reports token env state", () => {
  const text = doctorReport(
    {
      mcpUrl: "https://example.test/mcp",
      tokenEnv: "TOKEN"
    },
    { TOKEN: "plpat_test" }
  );

  assert.match(text, /TOKEN: set/);
});

test("Claude execution args use the token value for direct process execution", () => {
  const [command] = buildInstallCommands({
    client: "claude",
    mcpUrl: DEFAULT_MCP_URL,
    tokenEnv: "TOKEN"
  });

  const args = executionArgs(command, { tokenEnv: "TOKEN" }, { TOKEN: "plpat_secret" });

  assert.ok(args.includes("Authorization: Bearer plpat_secret"));
});

test("redacts token values from command output", () => {
  const text = redactSecrets(
    "stored Authorization: Bearer plpat_secret",
    { tokenEnv: "TOKEN" },
    { TOKEN: "plpat_secret" }
  );

  assert.equal(text, "stored Authorization: Bearer [TOKEN]");
});

test("entrypoint detection resolves npm bin symlinks", () => {
  const target = new URL("../bin/protoline.mjs", import.meta.url);
  const path = target.pathname;

  assert.equal(isEntrypointPath(path, target.href), true);
});

test("unknown command fails", () => {
  const result = run({ command: "wat" });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /Unknown command: wat/);
});
