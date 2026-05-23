#!/usr/bin/env node
// Stop 훅: 코드 파일 수정 후 pnpm lint + npx tsc --noEmit 자동 실행.
// 실패 시 stderr 출력 + exit 2 → Claude Code 가 stderr 를 모델에 피드백하여 자동 수정 루프 진입.
// 마지막 성공 시점 이후 코드 파일 mtime 이 변하지 않았다면 스킵 (Q&A 턴에서 불필요한 재실행 방지).
// Node 로 작성하여 Windows(PowerShell)/Git Bash/WSL/Linux 어디서나 동일하게 동작.

import { spawnSync } from "node:child_process";
import { closeSync, existsSync, openSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..", "..");
process.chdir(projectRoot);

const SENTINEL = ".claude/.last-lint-tsc-ok";
const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

function hasNewerCodeFile(rootDir, sentinelMtimeMs) {
  const stack = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        stack.push(full);
      } else if (entry.isFile() && CODE_EXT.test(entry.name)) {
        try {
          if (statSync(full).mtimeMs > sentinelMtimeMs) return true;
        } catch {
          // 권한 등으로 stat 실패하면 무시
        }
      }
    }
  }
  return false;
}

if (existsSync(SENTINEL)) {
  const sentinelMtimeMs = statSync(SENTINEL).mtimeMs;
  if (!hasNewerCodeFile(projectRoot, sentinelMtimeMs)) {
    process.exit(0);
  }
}

const isWindows = process.platform === "win32";

function run(cmd, args) {
  // Windows 의 pnpm/npx 는 .cmd shim 이므로 shell:true 가 필요.
  return spawnSync(cmd, args, { encoding: "utf8", shell: isWindows });
}

let errors = "";

const lint = run("pnpm", ["-s", "lint"]);
if (lint.status !== 0) {
  errors += `[pnpm lint] FAILED:\n${(lint.stdout ?? "") + (lint.stderr ?? "")}\n\n`;
}

const tsc = run("npx", ["tsc", "--noEmit"]);
if (tsc.status !== 0) {
  errors += `[npx tsc --noEmit] FAILED:\n${(tsc.stdout ?? "") + (tsc.stderr ?? "")}\n`;
}

if (errors.length > 0) {
  process.stderr.write(errors);
  process.exit(2);
}

closeSync(openSync(SENTINEL, "w"));
process.exit(0);
