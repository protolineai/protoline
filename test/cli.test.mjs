import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test from "node:test";
import {
  CLAUDE_SKILL_NAME,
  CODEX_SKILL_NAME,
  DEFAULT_OAUTH_SCOPES,
  DEFAULT_MCP_URL,
  agentSkillPreviewLines,
  buildLoginCommands,
  buildBootstrapCommands,
  claudeSkillPath,
  claudeSkillPreviewLines,
  codexSkillPath,
  codexSkillPreviewLines,
  doctorReport,
  installAgentSkills,
  installClaudeSkill,
  installCodexSkill,
  isEntrypointPath,
  bootstrapMessage,
  parseArgs,
  run,
  tokenSetupLines
} from "../bin/protoline.mjs";

test("builds Codex and Claude bootstrap commands", () => {
  const commands = buildBootstrapCommands({
    client: "all",
    mcpUrl: DEFAULT_MCP_URL,
    pat: false
  });

  assert.deepEqual(
    commands.map((command) => command.client),
    ["codex", "claude"]
  );
  assert.equal(commands[0].command, "codex");
  assert.ok(commands[0].args.includes("--oauth-resource"));
  assert.ok(!commands[0].args.includes("--bearer-token-env-var"));
  assert.equal(commands[1].command, "claude");
  assert.ok(!commands[1].args.some((arg) => arg.includes("Authorization: Bearer")));
});

test("parses bootstrap options", () => {
  const options = parseArgs([
    "bootstrap",
    "--client",
    "codex",
    "--execute",
    "--url",
    "https://example.test/mcp"
  ]);

  assert.equal(options.command, "bootstrap");
  assert.equal(options.client, "codex");
  assert.equal(options.execute, true);
  assert.equal(options.dryRun, false);
  assert.equal(options.skills, true);
  assert.equal(options.login, true);
  assert.equal(options.mcpUrl, "https://example.test/mcp");
  assert.equal(options.pat, false);
});

test("rejects token-based MCP setup options", () => {
  assert.throws(() => parseArgs(["bootstrap", "--pat"]), /Unknown option: --pat/);
  assert.throws(() => parseArgs(["bootstrap", "--manual-token"]), /Unknown option: --manual-token/);
  assert.throws(() => parseArgs(["bootstrap", "--token-env", "TOKEN"]), /Unknown option: --token-env/);
});

test("bootstrap executes by default and supports dry run", () => {
  assert.equal(parseArgs(["bootstrap"]).execute, true);

  const options = parseArgs(["bootstrap", "--dry-run"]);
  assert.equal(options.execute, false);
  assert.equal(options.dryRun, true);
});

test("bootstrap supports disabling skills and OAuth login", () => {
  const options = parseArgs(["bootstrap", "--no-skills", "--no-login"]);

  assert.equal(options.skills, false);
  assert.equal(options.login, false);
  assert.deepEqual(codexSkillPreviewLines(options), []);
  assert.deepEqual(claudeSkillPreviewLines(options), []);
  assert.deepEqual(agentSkillPreviewLines(options), []);
});

test("bootstrap message points users to OAuth by default", () => {
  const text = bootstrapMessage({
    manualToken: false
  });

  assert.match(text, /OAuth/);
  assert.match(text, new RegExp(DEFAULT_OAUTH_SCOPES.join(",")));
  assert.doesNotMatch(text, /export TOKEN/);
});

test("OAuth bootstrap setup message does not require a token", () => {
  assert.deepEqual(tokenSetupLines(), [
    "OAuth setup does not require a token environment variable."
  ]);
});

test("bootstrap dry run prints commands without executing them", () => {
  const result = run(
    parseArgs([
      "bootstrap",
      "--client",
      "codex",
      "--dry-run",
      "--url",
      "https://example.test/mcp"
    ])
  );

  assert.equal(result.code, 0);
  assert.match(result.stdout, /OAuth setup does not require/);
  assert.match(
    result.stdout,
    /codex mcp add protoline --url https:\/\/example\.test\/mcp --oauth-resource https:\/\/example\.test\/mcp/
  );
  assert.match(result.stdout, /Install local Codex skill:/);
  assert.match(result.stdout, /Run without --dry-run to bootstrap from this CLI\./);
});

test("bootstrap dry run includes Claude skill for Claude client", () => {
  const result = run(parseArgs(["bootstrap", "--client", "claude", "--dry-run"]));

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Install local Claude skill:/);
  assert.doesNotMatch(result.stdout, /Install local Codex skill:/);
});

test("bootstrap execution output does not echo the command being run", () => {
  const previousHome = process.env.HOME;
  const previousCodexHome = process.env.CODEX_HOME;
  const previousPath = process.env.PATH;
  const home = mkdtempSync(join(tmpdir(), "protoline-home-"));
  const bin = join(home, "bin");
  const fakeCodex = join(bin, "codex");
  mkdirSync(bin, { recursive: true });
  writeFileSync(fakeCodex, "#!/bin/sh\necho \"Added global MCP server 'protoline'.\"\n");
  chmodSync(fakeCodex, 0o755);
  process.env.HOME = home;
  process.env.CODEX_HOME = join(home, "codex");
  process.env.PATH = `${bin}${delimiter}${previousPath ?? ""}`;
  mkdirSync(process.env.CODEX_HOME, { recursive: true });

  try {
    const result = run(parseArgs(["bootstrap", "--client", "codex", "--no-skills", "--no-login"]));

    assert.equal(result.code, 0);
    assert.doesNotMatch(result.stdout, /\$ codex mcp add/);
    assert.match(result.stdout, /Added global MCP server 'protoline'\./);
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }

    if (previousCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }

    if (previousPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = previousPath;
    }
  }
});

test("codex skill installs into CODEX_HOME", () => {
  const codexHome = mkdtempSync(join(tmpdir(), "protoline-codex-home-"));
  const env = { CODEX_HOME: codexHome };
  const result = installCodexSkill({ client: "codex", skills: true }, env);
  const targetPath = codexSkillPath(env);

  assert.equal(targetPath, join(codexHome, "skills", CODEX_SKILL_NAME, "SKILL.md"));
  assert.match(result, new RegExp(targetPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(readFileSync(targetPath, "utf8"), /name: protoline/);
});

test("claude skill installs into CLAUDE_HOME", () => {
  const claudeHome = mkdtempSync(join(tmpdir(), "protoline-claude-home-"));
  const env = { CLAUDE_HOME: claudeHome };
  const result = installClaudeSkill({ client: "claude", skills: true }, env);
  const targetPath = claudeSkillPath(env);

  assert.equal(targetPath, join(claudeHome, "skills", CLAUDE_SKILL_NAME, "SKILL.md"));
  assert.match(result, new RegExp(targetPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(readFileSync(targetPath, "utf8"), /argument-hint: "\[new\|publish\|promote\|login\]"/);
});

test("all client skill installation writes both agent skills", () => {
  const codexHome = mkdtempSync(join(tmpdir(), "protoline-codex-home-"));
  const claudeHome = mkdtempSync(join(tmpdir(), "protoline-claude-home-"));
  const results = installAgentSkills(
    { client: "all", skills: true },
    { CODEX_HOME: codexHome, CLAUDE_HOME: claudeHome }
  );

  assert.equal(results.length, 2);
  assert.match(readFileSync(join(codexHome, "skills", "protoline", "SKILL.md"), "utf8"), /name: protoline/);
  assert.match(readFileSync(join(claudeHome, "skills", "protoline", "SKILL.md"), "utf8"), /name: protoline/);
});

test("codex skill installation can be skipped", () => {
  const codexHome = mkdtempSync(join(tmpdir(), "protoline-codex-home-"));
  const claudeHome = mkdtempSync(join(tmpdir(), "protoline-claude-home-"));
  const result = installCodexSkill({ client: "codex", skills: false }, { CODEX_HOME: codexHome });
  const claudeResult = installClaudeSkill(
    { client: "claude", skills: false },
    { CLAUDE_HOME: claudeHome }
  );

  assert.equal(result, null);
  assert.equal(claudeResult, null);
});

test("doctor reports OAuth setup state", () => {
  const text = doctorReport(
    {
      mcpUrl: "https://example.test/mcp"
    },
    {}
  );

  assert.match(text, /Hosted MCP auth: OAuth/);
  assert.match(text, /codex skill: /);
  assert.match(text, /claude skill: /);
});

test("builds Codex OAuth login command", () => {
  const [command] = buildLoginCommands({ client: "codex" });

  assert.equal(command.command, "codex");
  assert.deepEqual(command.args, [
    "mcp",
    "login",
    "protoline",
    "--scopes",
    DEFAULT_OAUTH_SCOPES.join(",")
  ]);
});

test("bootstrap dry run configures and prints OAuth login next steps", () => {
  const result = run(parseArgs(["bootstrap", "--client", "codex", "--dry-run", "--no-skills"]));

  assert.equal(result.code, 0);
  assert.match(result.stdout, /codex mcp add protoline --url/);
  assert.match(result.stdout, /codex mcp login protoline --scopes/);
  assert.doesNotMatch(result.stdout, /plpat_/);
});

test("bootstrap --no-login skips OAuth login next steps", () => {
  const result = run(
    parseArgs(["bootstrap", "--client", "codex", "--dry-run", "--no-skills", "--no-login"])
  );

  assert.equal(result.code, 0);
  assert.match(result.stdout, /codex mcp add protoline --url/);
  assert.doesNotMatch(result.stdout, /codex mcp login protoline --scopes/);
  assert.match(result.stdout, /OAuth login skipped by --no-login/);
});

test("login dry run only starts OAuth for configured clients", () => {
  const result = run(parseArgs(["login", "--client", "codex", "--dry-run"]));

  assert.equal(result.code, 0);
  assert.doesNotMatch(result.stdout, /codex mcp add protoline --url/);
  assert.match(result.stdout, /codex mcp login protoline --scopes/);
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
