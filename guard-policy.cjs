#!/usr/bin/env bun
// Shared shell-command policy for Pi and Claude hooks.
// Returns a deny message before broad git staging, hook bypass, or direct
// Python environment/tooling commands can run.

// Split on shell separators that are actually separators — a `;` or `|` inside
// quotes is an argument. Splitting the raw string blocked ordinary commands
// whose *arguments* merely mention a guarded tool, `grep -E "uv|python"` being
// the one that bites daily: the naive split produced a bare `python` segment.
// Still approximate by design (no substitution or heredoc parsing); it only has
// to find command positions well enough to judge them.
function splitShellSegments(command) {
  const segments = [];
  let current = "";
  let quote = null;

  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];

    if (quote) {
      current += char;
      if (char === "\\" && quote === '"' && i + 1 < command.length) {
        current += command[i + 1];
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (char === "\\" && i + 1 < command.length) {
      current += char + command[i + 1];
      i += 1;
      continue;
    }

    if (char === "\n" || char === ";" || char === "|" || char === "&") {
      segments.push(current);
      current = "";
      // Consume the second character of `&&` and `||` so it cannot start a segment.
      if (command[i + 1] === char) i += 1;
      continue;
    }

    current += char;
  }
  segments.push(current);

  return segments.map((segment) => segment.trim()).filter(Boolean);
}

function shellTokens(segment) {
  const tokens = [];
  let token = "", quote = null, started = false;
  for (let i = 0; i < segment.length; i += 1) {
    const char = segment[i];
    if (char === "\\" && quote !== "'" && i + 1 < segment.length) {
      const next = segment[i + 1];
      if (!quote || '"\\$`\n'.includes(next)) {
        if (next !== "\n") { token += next; started = true; }
        i += 1;
        continue;
      }
    }
    if (quote) {
      if (char === quote) quote = null;
      else token += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) tokens.push(token);
      token = "";
      started = false;
    } else {
      token += char;
      started = true;
    }
  }
  if (started) tokens.push(token);
  return tokens;
}

function basename(command) {
  return command.split(/[\\/]/).pop() ?? command;
}

function commandIndex(tokens, assignments) {
  let index = 0;
  while (index < tokens.length) {
    while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index] ?? "")) {
      assignments?.push(tokens[index]);
      index += 1;
    }
    const wrapper = basename(tokens[index] ?? "");
    if (!["command", "exec", "env"].includes(wrapper)) return index;
    index += 1;
    while ((tokens[index] ?? "").startsWith("-")) {
      const option = tokens[index++];
      if (option === "--") break;
      if (wrapper === "command" && /^-[^-]*[vV]/.test(option)) return undefined;
      if ((wrapper === "exec" && option === "-a") ||
          (wrapper === "env" && ["-u", "--unset", "-C", "--chdir"].includes(option))) index += 1;
    }
  }
  return undefined;
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

    const cmdIndex = commandIndex(tokens);
    const cmd = tokens[cmdIndex];
    if (!cmd) continue;
    const cmdName = basename(cmd);

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

// ponytail: ordinary shell/Git argv only; substitutions, aliases and shell
// programs need host authorization, not a pretend sandbox or a full shell parser.
function getBlockedGitMessage(command) {
  if (typeof command !== "string") return null;
  for (const segment of splitShellSegments(command)) {
    const tokens = shellTokens(segment);
    const assignments = [];
    const cmdIndex = commandIndex(tokens, assignments);
    const cmd = tokens[cmdIndex];
    if (!cmd || basename(cmd) !== "git") continue;
    let i = cmdIndex + 1;
    let hooksOverride = assignments.some((value) => value === "HK=0" || /^HK_SKIP_STEPS=.+/.test(value));
    while (tokens[i]?.startsWith("-")) {
      const option = tokens[i++];
      if (option === "--") break;
      if (option === "-c" || option === "--config-env") {
        hooksOverride ||= /^(?:core\.hooksPath|hook\..+\.(?:command|event|enabled))=/i.test(tokens[i] ?? "");
        i += 1;
      } else if (option.startsWith("-c") || option.startsWith("--config-env=")) {
        hooksOverride ||= /^(?:core\.hooksPath|hook\..+\.(?:command|event|enabled))=/i.test(option.replace(/^(?:-c|--config-env=)/, ""));
      } else if (["-C", "--git-dir", "--work-tree", "--namespace", "--super-prefix"].includes(option)) {
        i += 1;
      }
    }
    const subcommand = tokens[i++];
    if (subcommand !== "commit" && subcommand !== "add" && subcommand !== "stage") continue;
    let paths = 0, update = false, all = false, bypass = hooksOverride, options = true;
    for (; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (options && token === "--") { options = false; continue; }
      if (options && token.startsWith("-")) {
        if (subcommand === "commit") {
          if (token === "--no-verify") bypass = true;
          if (["--message", "--file", "--reuse-message", "--reedit-message", "--template", "--author", "--date", "--cleanup", "--trailer", "--fixup", "--squash", "--pathspec-from-file"].includes(token)) i += 1;
          if (!token.startsWith("--")) {
            for (let j = 1; j < token.length; j += 1) {
              if (token[j] === "n") bypass = true;
              if ("mFCct".includes(token[j])) {
                if (j === token.length - 1) i += 1;
                break;
              }
              if (token[j] === "S") break; // Attached signing-key operand.
            }
          }
        } else {
          all ||= token === "--all" || /^-[^-]*A/.test(token);
          update ||= token === "--update" || /^-[^-]*u/.test(token);
          if (["--chmod", "--pathspec-from-file"].includes(token)) i += 1;
        }
        continue;
      }
      paths += 1;
      if (subcommand !== "commit" && [".", "./", ":/"].includes(token)) all = true;
    }
    if (subcommand === "commit" && bypass) {
      return "Blocked: do not bypass integrity hooks with commit flags, environment skips or per-command hook overrides.";
    }
    if (subcommand !== "commit" && (all || (update && paths === 0))) {
      return "Blocked: stage exact paths, not broad all/update/root pathspecs. Run `git add <path> …` per logical commit.";
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
