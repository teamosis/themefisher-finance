#!/usr/bin/env node

/**
 * Skill Updater
 *
 * Copies Markdown files from the upstream skills defined in `.agents/skills.json`.
 *
 * Usage:
 *   ./.agents/update-skills.mjs                  # Update all remote skills
 *   ./.agents/update-skills.mjs taste-skill      # Update a single skill
 *   ./.agents/update-skills.mjs --list           # List configured skills
 *   ./.agents/update-skills.mjs --dry-run        # Check remote updates without modifying files
 *   ./.agents/update-skills.mjs --help           # Show help
 */

import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Paths
const AGENTS_DIR = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = resolve(AGENTS_DIR, "skills");
const MANIFEST_PATH = resolve(AGENTS_DIR, "skills.json");

// ANSI Colors
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.error(`${colors.red}✗${colors.reset} ${msg}`),
  title: (msg) =>
    console.log(
      `\n${colors.bold}${colors.blue}==>${colors.reset} ${colors.bold}${msg}${colors.reset}\n`,
    ),
};

// Help message
function showHelp() {
  console.log(`
${colors.bold}Sitepins Skill Updater${colors.reset}

${colors.dim}Usage:${colors.reset}
  ./.agents/update-skills.mjs [options] [skill-names...]

Adds or updates Markdown files from upstream and preserves other local files.

${colors.dim}Options:${colors.reset}
  --list, -l      List all configured skills and status
  --dry-run, -d   Simulate update without modifying local files
  --help, -h      Show this help message

${colors.dim}Examples:${colors.reset}
  ./.agents/update-skills.mjs                  Update all remote skills
  ./.agents/update-skills.mjs taste-skill      Update only taste-skill
  ./.agents/update-skills.mjs taste-skill shadcn
  ./.agents/update-skills.mjs --list
  ./.agents/update-skills.mjs --dry-run
`);
}

// Temporary directory tracker for cleanup
const activeTempDirs = new Set();

function createTempDir(prefix = "skills-update-") {
  const dir = join(
    tmpdir(),
    `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  mkdirSync(dir, { recursive: true });
  activeTempDirs.add(dir);
  return dir;
}

function cleanupTempDirs() {
  for (const dir of activeTempDirs) {
    try {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    } catch {}
  }
  activeTempDirs.clear();
}

// Ensure cleanup on signals
process.on("SIGINT", () => {
  cleanupTempDirs();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanupTempDirs();
  process.exit(143);
});
process.on("exit", () => {
  cleanupTempDirs();
});

function copyMarkdownFiles(sourceDir, targetDir) {
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const source = join(sourceDir, entry.name);
    const target = join(targetDir, entry.name);

    if (entry.isDirectory() && entry.name !== ".git") {
      copyMarkdownFiles(source, target);
    } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
      mkdirSync(targetDir, { recursive: true });
      cpSync(source, target);
    }
  }
}

// Load manifest
function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Skills manifest not found at ${MANIFEST_PATH}`);
  }
  const raw = readFileSync(MANIFEST_PATH, "utf8");
  return JSON.parse(raw);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  const manifest = loadManifest();
  const configuredSkills = manifest.skills || {};

  if (args.includes("--list") || args.includes("-l")) {
    log.title("Configured Skills in .agents/skills.json");
    console.log(
      `${colors.dim}Name                  Type     Repository / Notes${colors.reset}`,
    );
    console.log(
      `${colors.dim}────────────────────────────────────────────────────────────────────────${colors.reset}`,
    );
    for (const [name, config] of Object.entries(configuredSkills)) {
      const type = config.type || (config.repository ? "git" : "local");
      const targetPath = join(SKILLS_DIR, name);
      const exists = existsSync(targetPath);
      const statusIcon = exists
        ? `${colors.green}●${colors.reset}`
        : `${colors.red}○${colors.reset}`;
      const repoInfo = config.repository
        ? `${config.repository} [${config.branch || "main"}]`
        : config.description || "Local skill";
      console.log(
        `${statusIcon} ${name.padEnd(20)} ${type.padEnd(8)} ${colors.gray}${repoInfo}${colors.reset}`,
      );
    }
    console.log("");
    return;
  }

  const isDryRun = args.includes("--dry-run") || args.includes("-d");
  const specifiedSkills = args.filter((arg) => !arg.startsWith("-"));

  const skillsToProcess =
    specifiedSkills.length > 0
      ? specifiedSkills
      : Object.keys(configuredSkills);

  log.title(`Updating Skills ${isDryRun ? "(DRY RUN)" : ""}`);

  const results = {
    updated: [],
    skipped: [],
    failed: [],
  };

  const startTime = Date.now();

  for (const name of skillsToProcess) {
    const config = configuredSkills[name];

    if (!config) {
      log.error(`Skill "${name}" is not defined in ${MANIFEST_PATH}`);
      results.failed.push({ name, reason: "Not defined in manifest" });
      continue;
    }

    const type = config.type || (config.repository ? "git" : "local");

    if (type === "local" || type === "custom") {
      log.info(
        `Skipping ${colors.bold}${name}${colors.reset} (${type} skill, preserved)`,
      );
      results.skipped.push({ name, reason: `${type} skill` });
      continue;
    }

    if (!config.repository) {
      log.warn(
        `Skipping ${colors.bold}${name}${colors.reset} (no repository configured)`,
      );
      results.skipped.push({ name, reason: "No repository" });
      continue;
    }

    const branch = config.branch || "main";
    const subpath = config.path || "";
    const targetDir = join(SKILLS_DIR, name);

    console.log(
      `\n${colors.cyan}▶${colors.reset} Fetching ${colors.bold}${name}${colors.reset} from ${colors.gray}${config.repository}${colors.reset}...`,
    );

    const tempDir = createTempDir(`skill-${name}-`);

    try {
      // Shallow clone target repository
      execSync(
        `git clone --depth 1 -b ${branch} --single-branch ${config.repository} "${tempDir}"`,
        {
          stdio: ["ignore", "ignore", "pipe"],
        },
      );

      // Get latest commit hash and message
      const commitInfo = execSync(
        `git -C "${tempDir}" log -1 --format="%h - %s"`,
        { encoding: "utf8" },
      ).trim();

      const sourceDir = subpath ? join(tempDir, subpath) : tempDir;

      if (!existsSync(sourceDir)) {
        throw new Error(
          `Subpath "${subpath}" does not exist in repository ${config.repository}`,
        );
      }

      const skillMdPath = join(sourceDir, "SKILL.md");
      if (!existsSync(skillMdPath)) {
        throw new Error(`SKILL.md not found in source directory: ${sourceDir}`);
      }

      if (isDryRun) {
        log.success(
          `[DRY RUN] ${colors.bold}${name}${colors.reset} would update to commit ${colors.magenta}${commitInfo}${colors.reset}`,
        );
        results.updated.push({ name, commit: commitInfo });
        continue;
      }

      copyMarkdownFiles(sourceDir, targetDir);

      log.success(
        `Updated ${colors.bold}${name}${colors.reset} to ${colors.magenta}${commitInfo}${colors.reset}`,
      );
      results.updated.push({ name, commit: commitInfo });
    } catch (err) {
      const errorMsg = err.stderr ? err.stderr.toString().trim() : err.message;
      log.error(
        `Failed to update ${colors.bold}${name}${colors.reset}: ${errorMsg}`,
      );
      results.failed.push({ name, reason: errorMsg });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
      activeTempDirs.delete(tempDir);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  // Summary
  console.log(
    `\n${colors.dim}────────────────────────────────────────────────────────────────────────${colors.reset}`,
  );
  console.log(
    `${colors.bold}Summary:${colors.reset} ${results.updated.length} updated, ${results.skipped.length} skipped, ${results.failed.length} failed in ${duration}s\n`,
  );

  if (results.failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  log.error(`Fatal error: ${err.message}`);
  cleanupTempDirs();
  process.exit(1);
});
