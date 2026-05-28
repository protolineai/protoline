import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MCP_URL,
  buildInstallCommands,
  doctorReport,
  executionArgs,
  loginMessage,
  parseArgs,
  redactSecrets,
  run
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
  assert.equal(options.tokenEnv, "TOKEN");
  assert.equal(options.mcpUrl, "https://example.test/mcp");
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

test("unknown command fails", () => {
  const result = run({ command: "wat" });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /Unknown command: wat/);
});
