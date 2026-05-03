// Parallel Planner with Review — four-phase orchestration loop
//
// This template drives a multi-phase workflow:
//   Phase 1 (Plan):             An opus agent analyzes open issues, builds a
//                               dependency graph, and outputs a <plan> JSON
//                               listing unblocked issues with branch names.
//   Phase 2 (Execute + Review): For each issue, a sandbox is created via
//                               createSandbox(). The implementer runs first
//                               (100 iterations). If it produces commits, a
//                               reviewer runs in the same sandbox on the same
//                               branch (1 iteration). All issue pipelines run
//                               concurrently via Promise.allSettled().
//   Phase 3 (Merge):            A single agent merges all completed branches
//                               into the current branch.
//
// The outer loop repeats up to MAX_ITERATIONS times so that newly unblocked
// issues are picked up after each round of merges.
//
// Usage:
//   npx tsx .sandcastle/main.ts
// Or add to package.json:
//   "scripts": { "sandcastle": "npx tsx .sandcastle/main.ts" }

import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import * as sandcastle from "@ai-hero/sandcastle";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Maximum number of plan→execute→merge cycles before stopping.
// Raise this if your backlog is large; lower it for a quick smoke-test run.
const MAX_ITERATIONS = 10;

const sandcastleRuntimePath = ".sandcastle/worktrees";
const gitConfigHostPath = `${sandcastleRuntimePath}/gitconfig`;
const corepackHomePath = `${sandcastleRuntimePath}/corepack`;
const npmCachePath = `${sandcastleRuntimePath}/npm-cache`;
const pnpmStorePath = `${sandcastleRuntimePath}/pnpm-store`;
const hostCodexHome = path.join(os.homedir(), ".codex");
const hostGhConfigPath = [
  process.env.GH_CONFIG_DIR,
  process.env.APPDATA
    ? path.join(process.env.APPDATA, "GitHub CLI")
    : undefined,
  path.join(os.homedir(), ".config", "gh"),
].find((candidate): candidate is string =>
  Boolean(candidate && existsSync(candidate)),
);

mkdirSync(sandcastleRuntimePath, { recursive: true });
mkdirSync(corepackHomePath, { recursive: true });
mkdirSync(npmCachePath, { recursive: true });
mkdirSync(pnpmStorePath, { recursive: true });
if (!existsSync(gitConfigHostPath)) {
  writeFileSync(
    gitConfigHostPath,
    "# Git config used by Sandcastle containers.\n",
  );
}

// Hooks run inside the sandbox before the agent starts each iteration.
// Use pnpm through Corepack because this repo is a pnpm workspace.
const hooks = {
  sandbox: {
    onSandboxReady: [
      {
        command:
          'mkdir -p "$CODEX_HOME" && cp /mnt/host-codex/auth.json "$CODEX_HOME/auth.json" && if [ -f /mnt/host-codex/config.toml ]; then cp /mnt/host-codex/config.toml "$CODEX_HOME/config.toml"; fi',
      },
      {
        command: `corepack pnpm install --frozen-lockfile --store-dir ${pnpmStorePath}`,
      },
    ],
  },
};

const sandboxConfig = {
  // Sandcastle's Docker provider runs as the host UID but sets HOME to
  // /home/agent. Point Git's global config at the mounted workspace so
  // Git and package-manager writes happen under a writable directory.
  env: {
    CI: "true",
    CODEX_HOME: "/tmp/codex-home",
    COREPACK_HOME: `/home/agent/workspace/${corepackHomePath}`,
    GIT_CONFIG_GLOBAL: `/home/agent/workspace/${gitConfigHostPath}`,
    GH_TOKEN: "",
    NPM_CONFIG_CACHE: `/home/agent/workspace/${npmCachePath}`,
    npm_config_cache: `/home/agent/workspace/${npmCachePath}`,
  },
  mounts: [
    ...(hostGhConfigPath
      ? [
          {
            hostPath: hostGhConfigPath,
            sandboxPath: "/home/agent/.config/gh",
            readonly: true,
          },
        ]
      : []),
    {
      hostPath: hostCodexHome,
      sandboxPath: "/mnt/host-codex",
      readonly: true,
    },
  ],
};

// Models
const implementerModel = sandcastle.codex("gpt-5.5", { effort: "medium" });
const plannerModel = sandcastle.codex("gpt-5.5", { effort: "high" });
const mergerModel = sandcastle.codex("gpt-5.5", { effort: "medium" });
const reviewerModel = sandcastle.codex("gpt-5.5", { effort: "xhigh" });

const dockerWithConfig = () => docker(sandboxConfig);

// Copy node_modules from the host into the worktree before each sandbox
// starts. Avoids a full npm install from scratch; the hook above handles
// platform-specific binaries and any packages added since the last copy.
const copyToWorktree = ["node_modules"];

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);

  // -------------------------------------------------------------------------
  // Phase 1: Plan
  //
  // The planning agent (opus, for deeper reasoning) reads the open issue list,
  // builds a dependency graph, and selects the issues that can be worked in
  // parallel right now (i.e., no blocking dependencies on other open issues).
  //
  // It outputs a <plan> JSON block — we parse that to drive Phase 2.
  // -------------------------------------------------------------------------
  const plan = await sandcastle.run({
    hooks,
    sandbox: dockerWithConfig(),
    name: "planner",
    // One iteration is enough: the planner just needs to read and reason,
    // not write code.
    maxIterations: 1,
    // Opus for planning: dependency analysis benefits from deeper reasoning.
    agent: plannerModel,
    promptFile: "./.sandcastle/plan-prompt.md",
  });

  // Extract the <plan>…</plan> block from the agent's stdout.
  const planMatch = plan.stdout.match(/<plan>([\s\S]*?)<\/plan>/);
  if (!planMatch) {
    throw new Error(
      "Planning agent did not produce a <plan> tag.\n\n" + plan.stdout,
    );
  }

  // The plan JSON contains an array of issues, each with id, title, branch.
  const { issues } = JSON.parse(planMatch[1]!) as {
    issues: { id: string; title: string; branch: string }[];
  };

  if (issues.length === 0) {
    // No unblocked work — either everything is done or everything is blocked.
    console.log("No unblocked issues to work on. Exiting.");
    break;
  }

  console.log(
    `Planning complete. ${issues.length} issue(s) to work in parallel:`,
  );
  for (const issue of issues) {
    console.log(`  ${issue.id}: ${issue.title} → ${issue.branch}`);
  }

  // -------------------------------------------------------------------------
  // Phase 2: Execute + Review
  //
  // For each issue, create a sandbox via createSandbox() so the implementer
  // and reviewer share the same sandbox instance per branch. The implementer
  // runs first; if it produces commits, the reviewer runs in the same sandbox.
  //
  // Promise.allSettled means one failing pipeline doesn't cancel the others.
  // -------------------------------------------------------------------------

  const settled = await Promise.allSettled(
    issues.map(async (issue) => {
      const sandbox = await sandcastle.createSandbox({
        branch: issue.branch,
        sandbox: dockerWithConfig(),
        hooks,
        copyToWorktree,
      });

      try {
        // Run the implementer
        const implement = await sandbox.run({
          name: "implementer",
          maxIterations: 100,
          agent: implementerModel,
          promptFile: "./.sandcastle/implement-prompt.md",
          promptArgs: {
            TASK_ID: issue.id,
            ISSUE_TITLE: issue.title,
            BRANCH: issue.branch,
          },
        });

        // Only review if the implementer produced commits
        if (implement.commits.length > 0) {
          const review = await sandbox.run({
            name: "reviewer",
            maxIterations: 1,
            agent: reviewerModel,
            promptFile: "./.sandcastle/review-prompt.md",
            promptArgs: {
              BRANCH: issue.branch,
            },
          });

          // Merge commits from both runs so the merge phase sees all of them.
          // Each sandbox.run() only returns commits from its own run.
          return {
            ...review,
            commits: [...implement.commits, ...review.commits],
          };
        }

        return implement;
      } finally {
        await sandbox.close();
      }
    }),
  );

  // Log any agents that threw (network error, sandbox crash, etc.).
  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === "rejected") {
      console.error(
        `  ✗ ${issues[i]!.id} (${issues[i]!.branch}) failed: ${outcome.reason}`,
      );
    }
  }

  // Only pass branches that actually produced commits to the merge phase.
  // An agent that ran successfully but made no commits has nothing to merge.
  const completedIssues = settled
    .map((outcome, i) => ({ outcome, issue: issues[i]! }))
    .filter(
      (entry) =>
        entry.outcome.status === "fulfilled" &&
        entry.outcome.value.commits.length > 0,
    )
    .map((entry) => entry.issue);

  const completedBranches = completedIssues.map((i) => i.branch);

  console.log(
    `\nExecution complete. ${completedBranches.length} branch(es) with commits:`,
  );
  for (const branch of completedBranches) {
    console.log(`  ${branch}`);
  }

  if (completedBranches.length === 0) {
    // All agents ran but none made commits — nothing to merge this cycle.
    console.log("No commits produced. Nothing to merge.");
    continue;
  }

  // -------------------------------------------------------------------------
  // Phase 3: Merge
  //
  // One agent merges all completed branches into the current branch,
  // resolving any conflicts and running tests to confirm everything works.
  //
  // The {{BRANCHES}} and {{ISSUES}} prompt arguments are lists that the agent
  // uses to know which branches to merge and which issues to close.
  // -------------------------------------------------------------------------
  await sandcastle.run({
    hooks,
    sandbox: dockerWithConfig(),
    name: "merger",
    maxIterations: 1,
    agent: mergerModel,
    promptFile: "./.sandcastle/merge-prompt.md",
    promptArgs: {
      // A markdown list of branch names, one per line.
      BRANCHES: completedBranches.map((b) => `- ${b}`).join("\n"),
      // A markdown list of issue IDs and titles, one per line.
      ISSUES: completedIssues.map((i) => `- ${i.id}: ${i.title}`).join("\n"),
    },
  });

  console.log("\nBranches merged.");
}

console.log("\nAll done.");
