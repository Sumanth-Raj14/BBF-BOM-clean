#!/usr/bin/env node
/**
 * Verification oracles for the BBF-BOM -> BBF-BOM-clean migration.
 *
 * Each subcommand prints a single success-only token AFTER every assertion
 * passes, and exits non-zero with detail otherwise.
 *
 * Portable on purpose: no grep/tail/tr, which stock Windows lacks.
 */

import { execFileSync } from "node:child_process";

const OLD = "Sumanth-Raj14/BBF-BOM";
const NEW = "Sumanth-Raj14/BBF-BOM-clean";
const OLD_REMOTE = "origin";
const NEW_REMOTE = "clean";

function git(args, opts = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    ...opts,
  });
}

function fail(msg) {
  console.error("FAIL: " + msg);
  process.exit(1);
}

/** All refs on a remote, excluding the ^{} peel lines. */
function remoteRefs(remote) {
  const out = git(["ls-remote", remote]);
  const map = new Map();
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const [sha, ref] = line.split(/\s+/);
    if (!ref || ref.endsWith("^{}")) continue;
    map.set(ref, sha);
  }
  return map;
}

/** Commit a ref points at, peeling annotated tags. */
function peel(sha) {
  try {
    return git(["rev-list", "-n1", sha]).trim();
  } catch {
    return sha;
  }
}

/** Every commit reachable from the clean repo's refs, as walkable tips. */
function cleanTips() {
  const refs = remoteRefs(NEW_REMOTE);
  const tips = [];
  for (const [ref, sha] of refs) {
    if (ref === "HEAD") continue;
    const c = peel(sha);
    // The object must be present locally to walk it.
    try {
      git(["cat-file", "-e", c + "^{commit}"]);
      tips.push(c);
    } catch {
      fail(`clean ref ${ref} -> ${c.slice(0, 9)} is not fetched locally; run: git fetch clean --tags`);
    }
  }
  if (!tips.length) fail("no walkable refs found on the clean remote");
  return tips;
}

const TRAILER = /^\s*co-?authored-by:\s*.*(claude|anthropic)/im;
const IDENTITY = /noreply@anthropic\.com/i;

// ---------------------------------------------------------------- attribution
function attribution() {
  const tips = cleanTips();
  const log = git([
    "log",
    "--format=%H%x1f%an <%ae>%x1f%cn <%ce>%x1f%B%x1e",
    ...tips,
  ]);
  const recs = log.split("\x1e").filter((r) => r.trim());
  const hits = [];
  for (const r of recs) {
    const f = r.trim().split("\x1f");
    if (f.length < 4) continue;
    const [sha, an, cn, body] = f;
    const blob = [an, cn, body].join("\n");
    if (TRAILER.test(blob) || IDENTITY.test(blob)) hits.push(sha.slice(0, 9));
  }
  if (hits.length) fail(`${hits.length} commit(s) carry attribution: ${hits.slice(0, 8).join(", ")}`);
  if (recs.length < 100) fail(`only ${recs.length} commits walked — the ref set looks wrong, so "clean" would be vacuous`);
  console.log(`CLEAN_ALL_REFS commits=${recs.length} tips=${tips.length}`);
}

// -------------------------------------------------------------------- authors
function authors() {
  const tips = cleanTips();
  const out = git(["log", "--format=%an <%ae>", ...tips]);
  const set = [...new Set(out.split("\n").map((s) => s.trim()).filter(Boolean))];
  const bad = set.filter((a) => a !== "Sumanth-Raj-BBF <sumanthraj@blackboxfactories.com>");
  if (bad.length) fail("unexpected author(s): " + bad.join(" | "));
  console.log("SOLE_AUTHOR_ALL_REFS authors=" + set.length);
}

// -------------------------------------------------------------------- content
function blobs(ref) {
  const out = git(["ls-tree", "-r", ref]);
  const m = new Map();
  for (const line of out.split("\n")) {
    if (!line.includes("\t")) continue;
    const [meta, path] = line.split("\t");
    m.set(path, meta.split(/\s+/)[2]);
  }
  return m;
}

function content() {
  const oldSha = remoteRefs(OLD_REMOTE).get("refs/heads/master");
  const newSha = remoteRefs(NEW_REMOTE).get("refs/heads/master");
  if (!oldSha || !newSha) fail("master missing on one of the remotes");
  const a = blobs(oldSha);
  const b = blobs(newSha);
  if (a.size === 0) fail("old master tree is empty — comparison would be vacuous");
  const onlyOld = [...a.keys()].filter((k) => !b.has(k));
  const onlyNew = [...b.keys()].filter((k) => !a.has(k));
  const differing = [...a.keys()].filter((k) => b.has(k) && a.get(k) !== b.get(k));
  if (onlyOld.length || onlyNew.length || differing.length) {
    fail(
      `content differs — missing:${onlyOld.length} extra:${onlyNew.length} changed:${differing.length}` +
        (onlyOld.length ? `\n  first missing: ${onlyOld.slice(0, 5).join(", ")}` : ""),
    );
  }
  console.log(`CONTENT_IDENTICAL files=${a.size}`);
}

// ----------------------------------------------------------------------- tags
function tags() {
  const refs = remoteRefs(NEW_REMOTE);
  const masterSha = refs.get("refs/heads/master");
  const onMaster = new Set(git(["rev-list", peel(masterSha)]).split("\n").map((s) => s.trim()));
  const tagRefs = [...refs.keys()].filter((r) => r.startsWith("refs/tags/"));
  if (!tagRefs.length) fail("no tags on the clean repo — expected the three releases");
  const stray = [];
  for (const ref of tagRefs) {
    const c = peel(refs.get(ref));
    if (!onMaster.has(c)) stray.push(`${ref.replace("refs/tags/", "")}->${c.slice(0, 9)}`);
  }
  if (stray.length) fail("tag(s) point OFF the master lineage (pre-rewrite history): " + stray.join(", "));
  console.log(`TAGS_ON_LINEAGE tags=${tagRefs.length}`);
}

// ------------------------------------------------------------------ pull refs
// Asserts the PROPERTY, not a proxy for it.
//
// The first version of this check failed if the clean repo had ANY
// refs/pull/* at all. That was a fair proxy on migration day -- the repo had
// no PRs of its own, so any PR ref could only have been inherited -- but it
// expired the moment we opened PR #1 here. It then reported FAIL for two refs
// created by our own clean merges, which is a check crying wolf on the
// healthy state it was meant to protect.
//
// What actually matters is that no PR ref reaches a commit carrying Claude
// attribution. PR refs are immutable, so one tainted head is permanent --
// that is the whole reason the old repo could not be cleaned in place.
function pullrefs() {
  const refs = remoteRefs(NEW_REMOTE);
  const prRefs = [...refs.entries()].filter(([r]) => r.startsWith("refs/pull/"));

  const tainted = [];
  for (const [ref, sha] of prRefs) {
    const commit = ensureLocal(NEW_REMOTE, ref, sha);
    const body = git(["log", "-1", "--format=%an <%ae>%n%cn <%ce>%n%B", commit]);
    if (TRAILER.test(body) || IDENTITY.test(body)) tainted.push(`${ref} -> ${commit.slice(0, 9)}`);
  }

  // Positive control: the OLD repo's PR refs MUST still trip this, or the
  // absence above proves nothing about the matcher.
  const oldRefs = [...remoteRefs(OLD_REMOTE).entries()].filter(([r]) =>
    r.startsWith("refs/pull/"),
  );
  let controlHit = null;
  for (const [ref, sha] of oldRefs) {
    let body;
    try {
      body = git(["log", "-1", "--format=%an <%ae>%n%cn <%ce>%n%B", sha]);
    } catch {
      continue; // object not fetched locally; try the next one
    }
    if (TRAILER.test(body) || IDENTITY.test(body)) {
      controlHit = `${ref} -> ${sha.slice(0, 9)}`;
      break;
    }
  }
  if (!controlHit) {
    fail(
      "positive control found no tainted PR ref on the OLD repo. Either its refs " +
        "are not fetched locally (git fetch origin '+refs/pull/*/head:refs/remotes/origin/pr/*') " +
        "or the matcher is broken -- either way a clean verdict here is meaningless.",
    );
  }

  if (tainted.length) {
    fail(
      `${tainted.length} PR ref(s) on the clean repo carry attribution: ${tainted.join(", ")}. ` +
        "PR refs are immutable, so this cannot be rewritten away.",
    );
  }
  console.log(
    `PULL_REFS_CLEAN own=${prRefs.length} tainted=0 control=${controlHit}`,
  );
}

// Make a commit available locally so its message can be read. Fetching the
// exact ref is cheap and deterministic; failing loudly beats silently skipping
// a ref we could not inspect, which would read as "clean".
function ensureLocal(remote, ref, sha) {
  try {
    git(["cat-file", "-e", sha + "^{commit}"]);
    return sha;
  } catch {
    try {
      git(["fetch", "--quiet", remote, `${ref}:refs/tmp/unlazy-check`]);
      const resolved = git(["rev-parse", "refs/tmp/unlazy-check"]).trim();
      try {
        git(["update-ref", "-d", "refs/tmp/unlazy-check"]);
      } catch {
        /* leftover temp ref is harmless */
      }
      return resolved;
    } catch (e) {
      fail(`cannot inspect ${ref} (${sha.slice(0, 9)}): ${e.message}`);
      return sha;
    }
  }
}

// --------------------------------------------------------------- ref parity
function refparity() {
  const o = remoteRefs(OLD_REMOTE);
  const n = remoteRefs(NEW_REMOTE);
  const wanted = [...o.keys()].filter((r) => !r.startsWith("refs/pull/") && r !== "HEAD");
  const missing = wanted.filter((r) => !n.has(r));
  if (missing.length) fail("non-pull refs missing from the clean repo: " + missing.join(", "));
  console.log(`REF_PARITY_OK checked=${wanted.length}`);
}

// ----------------------------------------------------------------- GitHub API
function api(path) {
  const cred = execFileSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
  });
  const tok = (cred.split("\n").find((l) => l.startsWith("password=")) || "").slice(9);
  if (!tok) fail("no GitHub credential available");
  const out = execFileSync(
    "curl",
    ["-sS", "-H", `Authorization: Bearer ${tok}`, "-H", "Accept: application/vnd.github+json",
     `https://api.github.com/repos/${path}`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(out);
}

function protection() {
  const p = api(`${NEW}/branches/master/protection`);
  const rsc = p.required_status_checks || {};
  const n = (rsc.contexts || []).length;
  if (n !== 9) fail(`expected 9 required checks, found ${n}: ${JSON.stringify(rsc.contexts)}`);
  if (rsc.strict !== true) fail("strict (up-to-date-before-merge) is not enabled");
  if ((p.allow_force_pushes || {}).enabled !== false) fail("force pushes are allowed");
  if ((p.allow_deletions || {}).enabled !== false) fail("branch deletion is allowed");
  console.log(`PROTECTION_OK checks=${n} strict=true force_push=false delete=false`);
}

function contributors() {
  const d = api(`${NEW}/contributors?anon=1&per_page=100`);
  if (!Array.isArray(d)) fail("unexpected contributors payload: " + JSON.stringify(d).slice(0, 160));
  const logins = d.map((x) => x.login || x.name);
  if (logins.length !== 1 || logins[0] !== "Sumanth-Raj14") {
    fail(`expected exactly [Sumanth-Raj14], got ${JSON.stringify(logins)}`);
  }
  console.log(`ONE_CONTRIBUTOR ${logins[0]} commits=${d[0].contributions}`);
}

const table = { attribution, authors, content, tags, pullrefs, refparity, protection, contributors };
const cmd = process.argv[2];
if (!table[cmd]) {
  console.error("usage: .unlazy-migration-check.mjs <" + Object.keys(table).join("|") + ">");
  process.exit(2);
}
table[cmd]();
