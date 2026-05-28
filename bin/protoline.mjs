#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { pathToFileURL } from "node:url";

export const DEFAULT_MCP_URL = "https://app.protoline.ai/api/mcp";
export const DEFAULT_TOKEN_URL = "https://app.protoline.ai/profile#access-tokens";
export const DEFAULT_TOKEN_ENV = "PROTOLINE_MCP_TOKEN";
export const DEFAULT_INVOCATION = "npx -y @protoline/protoline";
export const CODEX_SKILL_NAME = "protoline";
export const CLAUDE_SKILL_NAME = "protoline";

const CODEX_SKILL_SOURCE_URL = new URL("../skills/protoline/SKILL.md", import.meta.url);

const helpText = `Protoline agent setup

Usage:
  protoline login [--no-open]
  protoline install [--client codex|claude|all] [--dry-run] [--no-skills]
  protoline doctor
  protoline help

Common path:
  1. ${DEFAULT_INVOCATION} login
  2. export PROTOLINE_MCP_TOKEN="plpat_..."
  3. ${DEFAULT_INVOCATION} install --client codex

Notes:
  - Protoline MCP is hosted at ${DEFAULT_MCP_URL}
  - Codex and Claude install small local skills by default; MCP tools still work without them.
`;

export function parseArgs(argv) {
  const [command = "help", ...rest] = argv;
  const options = {
    command,
    client: "all",
    execute: true,
    dryRun: false,
    skills: true,
    open: true,
    tokenEnv: DEFAULT_TOKEN_ENV,
    mcpUrl: DEFAULT_MCP_URL,
    tokenUrl: DEFAULT_TOKEN_URL
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === "--client") {
      options.client = valueAfter(rest, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--client=")) {
      options.client = arg.slice("--client=".length);
      continue;
    }

    if (arg === "--execute") {
      options.execute = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      options.execute = false;
      continue;
    }

    if (arg === "--skills") {
      options.skills = true;
      continue;
    }

    if (arg === "--no-skills") {
      options.skills = false;
      continue;
    }

    if (arg === "--open") {
      options.open = true;
      continue;
    }

    if (arg === "--no-open") {
      options.open = false;
      continue;
    }

    if (arg === "--token-env") {
      options.tokenEnv = valueAfter(rest, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--token-env=")) {
      options.tokenEnv = arg.slice("--token-env=".length);
      continue;
    }

    if (arg === "--url") {
      options.mcpUrl = valueAfter(rest, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--url=")) {
      options.mcpUrl = arg.slice("--url=".length);
      continue;
    }

    if (arg === "--token-url") {
      options.tokenUrl = valueAfter(rest, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--token-url=")) {
      options.tokenUrl = arg.slice("--token-url=".length);
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

export function selectedClients(client) {
  if (client === "all") {
    return ["codex", "claude"];
  }

  if (client === "codex" || client === "claude") {
    return [client];
  }

  throw new Error(`Unsupported client: ${client}`);
}

export function buildInstallCommands(options) {
  return selectedClients(options.client).map((client) => {
    if (client === "codex") {
      return {
        client,
        command: "codex",
        args: [
          "mcp",
          "add",
          "protoline",
          "--url",
          options.mcpUrl,
          "--bearer-token-env-var",
          options.tokenEnv
        ],
        display: `codex mcp add protoline --url ${options.mcpUrl} --bearer-token-env-var ${options.tokenEnv}`
      };
    }

    return {
      client,
      command: "claude",
      args: [
        "mcp",
        "add",
        "--transport",
        "http",
        "protoline",
        options.mcpUrl,
        "--header",
        `Authorization: Bearer $${options.tokenEnv}`
      ],
      display: `claude mcp add --transport http protoline ${options.mcpUrl} --header "Authorization: Bearer $${options.tokenEnv}"`
    };
  });
}

export function executionArgs(entry, options, env = process.env) {
  if (entry.client !== "claude") {
    return entry.args;
  }

  const token = env[options.tokenEnv];

  if (!token) {
    throw new Error(`${options.tokenEnv} must be set before installing Protoline MCP for Claude.`);
  }

  return entry.args.map((arg) =>
    arg === `Authorization: Bearer $${options.tokenEnv}`
      ? `Authorization: Bearer ${token}`
      : arg
  );
}

export function redactSecrets(text, options, env = process.env) {
  const token = env[options.tokenEnv];

  if (!token) {
    return text;
  }

  return text.split(token).join(`[${options.tokenEnv}]`);
}

export function loginMessage(options) {
  return [
    "Create a Protoline personal access token:",
    `  ${options.tokenUrl}`,
    "",
    "Recommended scopes:",
    "  project:read",
    "  project:create",
    "  project:write",
    "  deployment:write",
    "",
    "Then set it in your shell:",
    `  export ${options.tokenEnv}="plpat_..."`,
    "",
    "After that, run:",
    `  ${DEFAULT_INVOCATION} install --client codex`,
    `  ${DEFAULT_INVOCATION} install --client claude`
  ].join("\n");
}

export function doctorReport(options, env = process.env) {
  const lines = [
    "Protoline doctor",
    `MCP URL: ${options.mcpUrl}`,
    `${options.tokenEnv}: ${env[options.tokenEnv] ? "set" : "not set"}`
  ];

  for (const client of ["codex", "claude"]) {
    lines.push(`${client}: ${commandExists(client) ? "found" : "not found"}`);
  }

  lines.push(`codex skill: ${existsSync(codexSkillPath(env)) ? "installed" : "not installed"}`);
  lines.push(`claude skill: ${existsSync(claudeSkillPath(env)) ? "installed" : "not installed"}`);

  return lines.join("\n");
}

export function tokenSetupLines(options, env = process.env) {
  if (env[options.tokenEnv]) {
    return [`${options.tokenEnv} is set.`];
  }

  return [
    `Set ${options.tokenEnv} before adding Protoline MCP:`,
    `  export ${options.tokenEnv}="plpat_..."`,
    `If you already set it, make sure it is exported in this shell.`
  ];
}

export function codexSkillPath(env = process.env) {
  const codexHome = env.CODEX_HOME || join(homedir(), ".codex");
  return join(codexHome, "skills", CODEX_SKILL_NAME, "SKILL.md");
}

export function claudeSkillPath(env = process.env) {
  const claudeHome = env.CLAUDE_HOME || join(homedir(), ".claude");
  return join(claudeHome, "skills", CLAUDE_SKILL_NAME, "SKILL.md");
}

export function shouldInstallCodexSkill(options) {
  return Boolean(options.skills) && selectedClients(options.client).includes("codex");
}

export function shouldInstallClaudeSkill(options) {
  return Boolean(options.skills) && selectedClients(options.client).includes("claude");
}

export function codexSkillPreviewLines(options, env = process.env) {
  if (!shouldInstallCodexSkill(options)) {
    return [];
  }

  return [
    "Install local Codex skill:",
    `  ${codexSkillPath(env)}`,
    "Restart Codex after installing or updating skills."
  ];
}

export function claudeSkillPreviewLines(options, env = process.env) {
  if (!shouldInstallClaudeSkill(options)) {
    return [];
  }

  return [
    "Install local Claude skill:",
    `  ${claudeSkillPath(env)}`,
    "Restart Claude Code if the new skill does not appear."
  ];
}

export function agentSkillPreviewLines(options, env = process.env) {
  return [
    ...codexSkillPreviewLines(options, env),
    ...claudeSkillPreviewLines(options, env)
  ];
}

export function installCodexSkill(options, env = process.env) {
  if (!shouldInstallCodexSkill(options)) {
    return null;
  }

  const targetPath = codexSkillPath(env);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, readFileSync(CODEX_SKILL_SOURCE_URL, "utf8"));
  return `Codex skill installed: ${targetPath}\nRestart Codex after installing or updating skills.`;
}

export function installClaudeSkill(options, env = process.env) {
  if (!shouldInstallClaudeSkill(options)) {
    return null;
  }

  const targetPath = claudeSkillPath(env);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, readFileSync(CODEX_SKILL_SOURCE_URL, "utf8"));
  return `Claude skill installed: ${targetPath}\nRestart Claude Code if the new skill does not appear.`;
}

export function installAgentSkills(options, env = process.env) {
  return [installCodexSkill(options, env), installClaudeSkill(options, env)].filter(Boolean);
}

export function run(options) {
  switch (options.command) {
    case "help":
    case "--help":
    case "-h":
      return { code: 0, stdout: helpText };
    case "login":
      if (options.open) {
        openUrl(options.tokenUrl);
      }

      return { code: 0, stdout: loginMessage(options) };
    case "install":
      return install(options);
    case "doctor":
      return { code: 0, stdout: doctorReport(options) };
    default:
      return {
        code: 1,
        stderr: `Unknown command: ${options.command}\n\n${helpText}`
      };
  }
}

function install(options) {
  const commands = buildInstallCommands(options);
  const skillPreviewLines = agentSkillPreviewLines(options);

  if (options.dryRun || !options.execute) {
    return {
      code: 0,
      stdout: [
        ...tokenSetupLines(options),
        "",
        "Run these commands:",
        ...commands.map((entry) => `  ${entry.display}`),
        ...(skillPreviewLines.length ? ["", ...skillPreviewLines] : []),
        "",
        "Run without --dry-run to install from this CLI."
      ].join("\n")
    };
  }

  let executableCommands;

  try {
    executableCommands = commands.map((entry) => ({
      ...entry,
      args: executionArgs(entry, options)
    }));
  } catch (error) {
    return {
      code: 1,
      stderr: error instanceof Error ? error.message : "Unable to build install command."
    };
  }

  const outputs = [];
  outputs.push(...installAgentSkills(options));

  for (const entry of executableCommands) {
    const result = spawnSync(entry.command, entry.args, {
      stdio: "pipe",
      encoding: "utf8"
    });

    outputs.push(`$ ${entry.display}`);
    if (result.stdout) {
      outputs.push(redactSecrets(result.stdout.trimEnd(), options));
    }

    if (result.stderr) {
      outputs.push(redactSecrets(result.stderr.trimEnd(), options));
    }

    if (result.status !== 0) {
      return {
        code: result.status ?? 1,
        stdout: outputs.join("\n")
      };
    }
  }

  return { code: 0, stdout: outputs.join("\n") || "Protoline MCP installed." };
}

function commandExists(command) {
  const result = spawnSync(command, ["--version"], {
    stdio: "ignore"
  });
  return result.status === 0;
}

function openUrl(url) {
  const opener =
    platform() === "darwin" ? "open" : platform() === "win32" ? "cmd" : "xdg-open";
  const args = platform() === "win32" ? ["/c", "start", "", url] : [url];
  spawnSync(opener, args, { stdio: "ignore" });
}

function valueAfter(args, index, option) {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}

export function isEntrypointPath(argvPath, moduleUrl = import.meta.url) {
  return Boolean(argvPath) && moduleUrl === pathToFileURL(realpathSync(argvPath)).href;
}

function isEntrypoint() {
  return isEntrypointPath(process.argv[1]);
}

if (isEntrypoint()) {
  let result;

  try {
    result = run(parseArgs(process.argv.slice(2)));
  } catch (error) {
    result = {
      code: 1,
      stderr: error instanceof Error ? error.message : "Unknown error."
    };
  }

  if (result.stdout) {
    console.log(result.stdout);
  }

  if (result.stderr) {
    console.error(result.stderr);
  }

  process.exitCode = result.code;
}
