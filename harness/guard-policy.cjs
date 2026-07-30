#!/usr/bin/env bun
// Shared shell-command policy for Pi and Claude hooks.
// Returns a deny message before broad git staging, hook bypass, or direct
// Python environment/tooling commands can run.

function splitShellSegments(command) {
  return command
    .split(/\n|;|&&|\|\|?/) // intentionally approximate: catches normal shell segments before execution
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function shellTokens(segment) {
  return segment.match(/"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\S+/g)?.map((token) => {
    if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"'))) {
      return token.slice(1, -1);
    }
    return token;
  }) ?? [];
}

function basename(command) {
  return command.split(/[\\/]/).pop() ?? command;
}

function commandToken(tokens) {
  let index = 0;

  while (tokens[index] === "command" || tokens[index] === "exec") index += 1;
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index] ?? "")) index += 1;

  const first = tokens[index];
  if (first && basename(first) === "env") {
    index += 1;
    while ((tokens[index] ?? "").startsWith("-")) {
      // Good enough for our policy: env options may take operands, but skipping
      // the option token still leaves PATH shims as a fallback for exotic forms.
      index += 1;
    }
    while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index] ?? "")) index += 1;
  }

  return tokens[index];
}

function isPythonCommand(command) {
  return /^python(?:3(?:\.\d+)?)?$/.test(basename(command));
}

function isPipCommand(command) {
  return /^pip(?:3(?:\.\d+)?)?$/.test(basename(command));
}

function moduleAfterPython(tokens, commandIndex) {
  for (let i = commandIndex + 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === "-m") return tokens[i + 1];
    const compact = /^-m(.+)$/.exec(token);
    if (compact) return compact[1];
  }
  return undefined;
}

function disabledPipMessage(name = "pip") {
  return [
    `Error: ${name} is disabled. Use uv instead:`,
    "",
    "  To install a package for a script: uv run --with PACKAGE python script.py",
    "  To add a dependency to the project: uv add PACKAGE",
    "",
  ].join("\n");
}

function disabledPoetryMessage() {
  return [
    "Error: poetry is disabled. Use uv instead:",
    "",
    "  To initialize a project: uv init",
    "  To add a dependency: uv add PACKAGE",
    "  To sync dependencies: uv sync",
    "  To run commands: uv run COMMAND",
    "",
  ].join("\n");
}

function disabledPythonPipMessage() {
  return [
    "Error: 'python -m pip' is disabled. Use uv instead:",
    "",
    "  To install a package for a script: uv run --with PACKAGE python script.py",
    "  To add a dependency to the project: uv add PACKAGE",
    "",
  ].join("\n");
}

function disabledPythonVenvMessage() {
  return [
    "Error: 'python -m venv' is disabled. Use uv instead:",
    "",
    "  To create a virtual environment: uv venv",
    "",
  ].join("\n");
}

function disabledPythonPyCompileMessage() {
  return [
    "Error: 'python -m py_compile' is disabled because it writes .pyc files to __pycache__.",
    "",
    "  To verify syntax without bytecode output: uv run python -m ast path/to/file.py >/dev/null",
    "",
  ].join("\n");
}

function disabledDirectPythonMessage(name = "python") {
  return [
    `Error: direct ${name} is disabled. Use uv instead:`,
    "",
    "  To run a script: uv run script.py",
    "  To run Python code: uv run python -c 'print(1)'",
    "  To use a specific version: uv run -p 3.12 python -c 'print(1)'",
    "  To run a standalone versioned interpreter: uvx python@3.12 -c 'print(1)'",
    "",
  ].join("\n");
}

function getBlockedPythonToolMessage(command) {
  if (typeof command !== "string") return null;
  for (const segment of splitShellSegments(command)) {
    const tokens = shellTokens(segment);
    if (!tokens.length) continue;

    const cmd = commandToken(tokens);
    if (!cmd) continue;
    const cmdName = basename(cmd);
    const cmdIndex = tokens.indexOf(cmd);

    if (isPipCommand(cmd)) {
      return disabledPipMessage(cmdName);
    }

    if (cmdName === "poetry") {
      return disabledPoetryMessage();
    }

    if (isPythonCommand(cmd)) {
      const module = moduleAfterPython(tokens, cmdIndex);
      if (module === "pip") return disabledPythonPipMessage();
      if (module === "venv") return disabledPythonVenvMessage();
      if (module === "py_compile") return disabledPythonPyCompileMessage();
      return disabledDirectPythonMessage(cmdName);
    }
  }

  return null;
}

function getBlockedGitMessage(command) {
  if (typeof command !== "string") return null;
  for (const segment of splitShellSegments(command)) {
    if (/^git\s+(add|stage)\b/.test(segment) && /(?:^|\s)(?:-A|--all|\.)(?:\s|$)/.test(segment)) {
      return "Blocked: stage exact paths — `git add -A`/`.`/`--all` is off-limits. Run `git add <path> …` per logical commit.";
    }
    if (/^git\s+commit\b/.test(segment) && /(?:^|\s)(?:--no-verify|-n)(?:\s|$)/.test(segment)) {
      return "Blocked: `git commit --no-verify` skips integrity hooks. Commit without it.";
    }
  }
  return null;
}

function getBlockedCommandMessage(command) {
  return getBlockedPythonToolMessage(command) || getBlockedGitMessage(command);
}

module.exports = {
  getBlockedCommandMessage,
  getBlockedGitMessage,
  getBlockedPythonToolMessage,
  shellTokens,
  splitShellSegments,
};
