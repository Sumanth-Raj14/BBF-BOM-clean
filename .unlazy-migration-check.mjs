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

import {
  BOT_NAME,
  IDENTITY,
  TRAILER,
  assertMatcherWorks,
  hasAttribution,
} from "./.unlazy-attribution.mjs";

const NEW = "Sumanth-Raj14/BBF-BOM-clean";
const NEW_REMOTE = "clean";

// Migration-day anchors, pinned by hash.
//
// G3, G5 and G6 used to read the OLD repo live. G10 retires that repo AND
// renames this one to BBF-BOM -- which would make the `origin` URL resolve to
// THIS repo. G3 would then have compared the clean repo with itself and G6
// checked its refs against its own, both printing PASS while measuring
// nothing: a silent vacuum, which is worse than the loud false alarm G3 and
// G5 were just fixed for.
//
// A tree hash is a cryptographic anchor, so it proves exactly as much after
// the old repo is deleted as it did while it existed. There is deliberately
// no OLD_REMOTE constant any more: the dependency is removed by construction,
// not by discipline.
const OLD_MASTER_TREE = "0dce386bfc30639e4f552b3f0e76117eb2d21d8e";
const OLD_MASTER_FILES = 1139;
const OLD_NON_PULL_REFS = [
  "refs/heads/fix/npm-audit-high",
  "refs/heads/master",
  "refs/heads/wip/gap-closing-2026-08-02",
  "refs/tags/v1.3.0",
  "refs/tags/v2.0.0",
  "refs/tags/v2.1.0",
];

// Branch protection, by NAME. The old check compared only the COUNT, so it
// failed if a tenth job was ever required -- i.e. if protection got stronger --
// and passed if all nine were swapped for junk. Containment, not equality, so
// adding a check is allowed and removing one is not.
const REQUIRED_CHECKS = [
  "Lint Backend",
  "Test Backend",
  "Lint & TypeCheck Frontend",
  "Test Frontend",
  "Build Frontend",
  "Security Scan",
  "Test Suite on Postgres",
  "Fresh Install on Postgres (init_db bootstrap)",
  "Migration Upgrade Path (incremental alembic upgrade head)",
];

// GitHub lists commit AUTHORS here. The old check demanded exactly one, which
// would have failed the first time the collaborator G9 exists to onboard
// landed a commit -- two gates in direct contradiction.
const CONTRIBUTOR_ALLOWLIST = ["Sumanth-Raj14", "saisasivardhan-bb"];

const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

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
    // Fetch anything missing rather than failing. The old branch failed with
    // "run: git fetch clean --tags", which does NOT fetch refs/pull/* -- so on
    // a fresh clone the gate stopped with advice that could not fix it.
    tips.push(peel(ensureLocal(NEW_REMOTE, ref, sha)));
  }
  if (!tips.length) fail("no walkable refs found on the clean remote");
  return tips;
}


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
  // An absence claim needs its matcher proven, or "no hits" may only mean the
  // search is broken.
  const control = assertMatcherWorks();
  console.log(`CLEAN_ALL_REFS commits=${recs.length} tips=${tips.length} control=${control}`);
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

// Asserts the PROPERTY, not a proxy for it.
//
// The first version required the clean master tree to be byte-identical to
// the old master tree. That was right on migration day -- it proved the
// import lost nothing -- but it expired as soon as PR #1 was merged here,
// because from then on the clean repo is SUPPOSED to move on. It began
// reporting our own merged work as damage ("extra:14 changed:14"), the same
// expiring-proxy defect G5 had.
//
// What does not expire: the old repo's master tree must still exist,
// byte-identical, as an ancestor of the clean master. That is strictly
// stronger than comparing today's files -- it proves the WHOLE old repo
// arrived, not merely that the current working set still overlaps it --
// and later commits add descendants without altering that ancestor.
function content() {
  const newRef = remoteRefs(NEW_REMOTE).get("refs/heads/master");
  if (!newRef) fail("master missing on the clean remote");
  const newSha = peel(newRef);

  // One log pass, not one rev-parse per commit.
  const pairs = git(["log", "--format=%H %T", newSha])
    .trim()
    .split("\n")
    .map((l) => l.trim().split(" "))
    .filter((pair) => pair.length === 2);
  if (pairs.length < 100) {
    fail(
      `only ${pairs.length} commit(s) walked on the clean master — the history ` +
        "looks wrong, so a match would be vacuous",
    );
  }

  const found = pairs.find(([, t]) => t === OLD_MASTER_TREE);
  if (!found) {
    fail(
      `no ancestor of the clean master carries the imported tree ` +
        `(${OLD_MASTER_TREE.slice(0, 9)}), so the import is NOT provably intact: ` +
        `all ${OLD_MASTER_FILES} migrated file(s) would have to be reconciled by hand.`,
    );
  }
  const importedAt = found[0];

  // The pinned count does real work now that it no longer comes from the same
  // place as the tree: a tree that matched but held the wrong number of files
  // would mean the anchor itself is wrong.
  const importedFiles = blobs(importedAt);
  if (importedFiles.size !== OLD_MASTER_FILES) {
    fail(
      `the imported tree holds ${importedFiles.size} file(s), expected ` +
        `${OLD_MASTER_FILES} — the pinned anchor and this history disagree`,
    );
  }

  // Negative control: a genuinely absent tree must NOT be found, or "found"
  // proves nothing. Git's empty tree is never a commit tree in this history.
  if (OLD_MASTER_TREE === EMPTY_TREE) fail("the pinned tree IS the empty tree");
  if (pairs.some(([, t]) => t === EMPTY_TREE)) {
    fail(
      "the empty tree now appears as a commit tree, so it is no longer a valid " +
        "negative control — choose another absent tree before trusting this gate",
    );
  }

  // Drift since the import is the work merged here afterwards, which is the
  // point of the repo being alive. Report it; never fail on it.
  const now = blobs(newSha);
  const gone = [...importedFiles.keys()].filter((k) => !now.has(k)).length;
  const added = [...now.keys()].filter((k) => !importedFiles.has(k)).length;
  const changed = [...importedFiles.keys()].filter(
    (k) => now.has(k) && importedFiles.get(k) !== now.get(k),
  ).length;

  console.log(
    `IMPORT_INTACT files=${importedFiles.size} at=${importedAt.slice(0, 9)} ` +
      `drift_since=+${added}/~${changed}/-${gone}`,
  );
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

  // Positive control, hermetic. It used to require a tainted PR ref on the OLD
  // repo -- a corpus G10 deletes, after which this absence result would have
  // quietly stopped meaning anything.
  const controlHit = assertMatcherWorks();

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
  const n = remoteRefs(NEW_REMOTE);
  if (OLD_NON_PULL_REFS.length !== 6) {
    fail(
      `the pinned inventory lists ${OLD_NON_PULL_REFS.length} ref(s); the old repo ` +
        "had 6 non-pull refs, so a shortened list would pass by not looking",
    );
  }
  const missing = OLD_NON_PULL_REFS.filter((r) => !n.has(r));
  if (missing.length) {
    fail("ref(s) migrated from the old repo are missing here: " + missing.join(", "));
  }
  console.log(`REF_PARITY_OK checked=${OLD_NON_PULL_REFS.length}`);
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
  const ctx = rsc.contexts || [];
  const missing = REQUIRED_CHECKS.filter((c) => !ctx.includes(c));
  if (missing.length) fail(`required check(s) NOT enforced: ${missing.join(", ")}`);
  if (rsc.strict !== true) fail("strict (up-to-date-before-merge) is not enabled");
  if ((p.allow_force_pushes || {}).enabled !== false) fail("force pushes are allowed");
  if ((p.allow_deletions || {}).enabled !== false) fail("branch deletion is allowed");
  console.log(
    `PROTECTION_OK named=${REQUIRED_CHECKS.length} enforced=${ctx.length} ` +
      "strict=true force_push=false delete=false",
  );
}

function contributors() {
  const d = api(`${NEW}/contributors?anon=1&per_page=100`);
  if (!Array.isArray(d)) fail("unexpected contributors payload: " + JSON.stringify(d).slice(0, 160));
  if (!d.length) fail("GitHub listed NO contributors — a clean verdict would be vacuous");

  // The actual property, checked first and unconditionally.
  const attributed = d
    .map((x) => `${x.login || ""} ${x.name || ""}`.trim())
    .filter((who) => BOT_NAME.test(who) || hasAttribution(who));
  if (attributed.length) {
    fail(`Claude/Anthropic is listed as a contributor: ${attributed.join(", ")}`);
  }

  const logins = d.map((x) => x.login || x.name);
  if (!logins.includes("Sumanth-Raj14")) {
    fail(`the owner is absent from the contributor list (${logins.join(", ")}) — the listing looks wrong`);
  }
  const unexpected = logins.filter((l) => !CONTRIBUTOR_ALLOWLIST.includes(l));
  if (unexpected.length) {
    fail(
      `unexpected contributor(s): ${unexpected.join(", ")}. If this is a new ` +
        "teammate, add them to CONTRIBUTOR_ALLOWLIST; if it is not, find out why.",
    );
  }
  const total = d.reduce((a, x) => a + (x.contributions || 0), 0);
  console.log(`NO_BOT_CONTRIBUTOR people=${logins.length} commits=${total} [${logins.join(", ")}]`);
}

const table = { attribution, authors, content, tags, pullrefs, refparity, protection, contributors };
const cmd = process.argv[2];
if (!table[cmd]) {
  console.error("usage: .unlazy-migration-check.mjs <" + Object.keys(table).join("|") + ">");
  process.exit(2);
}
table[cmd]();
