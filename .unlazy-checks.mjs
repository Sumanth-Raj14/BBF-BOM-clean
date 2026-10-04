#!/usr/bin/env node
// Verification oracles for the attribution-scrub task.
//
// Each subcommand prints a single success-only token AFTER every assertion
// passes, and exits non-zero with detail otherwise. The token is never printed
// on a partial pass — that is the whole point of a success-only marker.
//
// Portable on purpose: no grep/tail/tr, which stock Windows lacks.

import { execFileSync } from "node:child_process";

const REFS = ["master", "wip/gap-closing-2026-08-02"];

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

function fail(msg) {
  console.error("FAIL: " + msg);
  process.exit(1);
}

// Resolve a ref, preferring the remote copy when asked.
function refsFor(scope) {
  if (scope === "remote") return REFS.map((r) => "origin/" + r);
  return REFS.slice();
}

// ---------------------------------------------------------------- trailers
// Absence assertion. Guarded by a positive control in `control` below, because
// a checker that can never find anything would "pass" on a broken search.
function noTrailers(scope) {
  const refs = refsFor(scope);
  const out = git([
    "log",
    ...refs,
    "--regexp-ignore-case",
    "--grep=co-authored-by",
    "--grep=claude",
    "--grep=anthropic",
    "--format=%H %s",
  ]).trim();

  // --grep ORs the patterns, so this also catches prose mentions; filter to
  // real trailers plus any author/committer identity hit.
  const offenders = [];
  for (const line of out ? out.split("\n") : []) {
    const sha = line.split(" ")[0];
    const body = git(["log", "-1", "--format=%an%n%ae%n%cn%n%ce%n%B", sha]);
    for (const l of body.split("\n")) {
      if (/^\s*co-authored-by:/i.test(l)) offenders.push(`${sha.slice(0, 9)} trailer: ${l.trim()}`);
      else if (/noreply@anthropic\.com/i.test(l)) offenders.push(`${sha.slice(0, 9)} identity: ${l.trim()}`);
    }
  }
  if (offenders.length) fail(`${offenders.length} attribution hit(s):\n  ` + offenders.join("\n  "));
  console.log("ATTRIBUTION_CLEAN");
}

// Positive control: prove the search above can actually find a trailer.
// Without this, "zero hits" might only mean the matcher is broken.
function control() {
  // Sample STRICTLY. The previous version took the first `--grep=co-authored-by`
  // hit and then asserted the strict trailer pattern on it. git's --grep matches
  // prose too, so it selected a commit whose message merely DISCUSSES the
  // trailer ("...reached origin with a Co-authored-by trailer naming Claude",
  // no colon) and the control failed on a repo that does contain real trailers.
  // A control that misfires like that would either block a clean result or, if
  // loosened the wrong way, certify a broken matcher.
  const out = git([
    "log",
    "--all",
    "--format=%H%x1f%B%x1e",
  ]);
  const recs = out.split("").filter((r) => r.trim());
  const strict = /^\s*co-?authored-by:\s*.*(claude|anthropic)/im;
  const found = [];
  for (const r of recs) {
    const [sha, body] = r.trim().split("");
    if (body && strict.test(body)) found.push(sha);
  }
  if (!found.length) {
    fail(
      "positive control found NO commit carrying a real trailer anywhere in this " +
        "clone, so an absence result elsewhere proves nothing. Fetch the old " +
        "repo's refs (git fetch origin) before trusting a CLEAN verdict.",
    );
  }
  console.log(`CONTROL_DETECTS_TRAILER samples=${found.length} e.g.=${found[0].slice(0, 9)}`);
}


// ----------------------------------------------------------------- authors
function soleAuthor(scope) {
  const refs = refsFor(scope);
  const out = git(["log", ...refs, "--format=%an <%ae>"]).trim();
  const bad = [...new Set(out.split("\n"))].filter(
    (a) => a !== "Sumanth-Raj-BBF <sumanthraj@blackboxfactories.com>"
  );
  if (bad.length) fail("unexpected author(s): " + bad.join(" | "));
  console.log("SOLE_AUTHOR_OK");
}

// ------------------------------------------------------------ content safe
// The rewrite must change metadata ONLY. Compare the tree object of each ref
// against the backup taken before the rewrite: identical tree = every byte of
// every file is unchanged.
function treesMatch() {
  const pairs = [
    ["master", "backup/pre-attribution-master"],
    ["wip/gap-closing-2026-08-02", "backup/pre-attribution-wip"],
  ];
  for (const [now, before] of pairs) {
    let a, b;
    try {
      a = git(["rev-parse", now + "^{tree}"]).trim();
      b = git(["rev-parse", before + "^{tree}"]).trim();
    } catch (e) {
      fail(`cannot resolve ${now} or ${before}: ${e.message}`);
    }
    if (a !== b) fail(`tree changed for ${now}: ${a} != ${b} (rewrite altered file content, not just metadata)`);
  }
  console.log("TREES_IDENTICAL");
}

// --------------------------------------------------------- picked-up work
// The two side-branch commits must actually be present as content.
function pickedWork() {
  const needed = [
    "backend/app/tests/test_ws_rate_limit.py",
    "frontend/src/root/__tests__/icons.test.jsx",
    "frontend/src/services/offlineSim.js",
  ];
  const tree = git(["ls-tree", "-r", "--name-only", "HEAD"]).split("\n");
  const missing = needed.filter((f) => !tree.includes(f));
  if (missing.length) fail("expected files absent from HEAD: " + missing.join(", "));
  // download.ts was deleted by the ES-module commit; its presence means the
  // pick did not actually apply.
  if (tree.includes("frontend/src/utils/download.ts"))
    fail("frontend/src/utils/download.ts still present — the ES-module commit did not apply");
  console.log("PICKED_WORK_PRESENT");
}

// ------------------------------------------------------------------ remote
function remoteMatchesLocal() {
  const out = git(["ls-remote", "--heads", "origin"]);
  const remote = new Map();
  for (const line of out.trim().split("\n")) {
    const [sha, ref] = line.split(/\s+/);
    remote.set(ref.replace("refs/heads/", ""), sha);
  }
  for (const r of REFS) {
    const local = git(["rev-parse", r]).trim();
    const rem = remote.get(r);
    if (!rem) fail(`origin has no branch ${r}`);
    if (rem !== local) fail(`${r}: local ${local.slice(0, 9)} != origin ${rem.slice(0, 9)}`);
  }
  console.log("REMOTE_IN_SYNC");
}

// Stale branches that carry the trailers must be gone from origin.
function staleBranchesGone() {
  // Any branch still holding the pre-rewrite tainted commits keeps Claude
  // attached to the repo, so all four must go -- including
  // test/e2e-ci-and-write-flows, which is 0 commits ahead of wip (fully
  // merged) but still contains 4d9b1d2 and 4c8c1c6.
  const stale = [
    "docs/sync-2026-08",
    "refactor/window-globals-batch2",
    "test/a3-a13-regressions",
    "test/e2e-ci-and-write-flows",
  ];
  const out = git(["ls-remote", "--heads", "origin"]);
  const present = stale.filter((b) => out.includes("refs/heads/" + b));
  if (present.length) fail("stale tainted branches still on origin: " + present.join(", "));
  console.log("STALE_BRANCHES_GONE");
}

const cmd = process.argv[2];
const scope = process.argv[3] || "local";
const table = {
  "no-trailers": () => noTrailers(scope),
  control,
  "sole-author": () => soleAuthor(scope),
  "trees-match": treesMatch,
  "picked-work": pickedWork,
  "remote-sync": remoteMatchesLocal,
  "stale-gone": staleBranchesGone,
};
if (!table[cmd]) {
  console.error("usage: .unlazy-checks.mjs <" + Object.keys(table).join("|") + "> [local|remote]");
  process.exit(2);
}
table[cmd]();
