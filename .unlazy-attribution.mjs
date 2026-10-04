#!/usr/bin/env node
/**
 * The attribution matcher, defined ONCE, with its own positive control.
 *
 * Two problems this file exists to remove:
 *
 * 1. The matcher used to be copy-pasted into .unlazy-checks.mjs and
 *    .unlazy-migration-check.mjs. G0's control exercised the first copy while
 *    G1/G2/G5 -- the gates that actually decide whether the repo is clean --
 *    used the second. Breaking the second left the control green. A single
 *    exported definition closes that by construction rather than by diligence.
 *
 * 2. The control used to sample a real tainted commit out of the contaminated
 *    repo. That repo is scheduled for deletion (G10), and once it was gone the
 *    control would have had no corpus, so every absence result that leans on
 *    it would have quietly stopped meaning anything. This mints its own
 *    specimen instead and depends on no remote at all.
 */

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const TRAILER = /^\s*co-?authored-by:\s*.*(claude|anthropic)/im;
export const IDENTITY = /noreply@anthropic\.com/i;
// For display names and logins, where neither a trailer nor an email appears.
export const BOT_NAME = /claude|anthropic/i;

/** True when a commit blob (author, committer, message) carries attribution. */
export function hasAttribution(blob) {
  return TRAILER.test(blob) || IDENTITY.test(blob);
}

function fail(msg) {
  console.error("FAIL: " + msg);
  process.exit(1);
}

function git(args, opts = {}) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
}

// Git's well-known empty tree: lets us mint a commit object without touching
// the index, the working tree, or any ref.
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

// Spelled in pieces so this file does not itself read as a contaminated commit
// to someone grepping the tree for the trailer.
const TRAILER_KEY = "Co-authored" + "-by";
const BOT_EMAIL = "noreply@" + "anthropic.com";

/**
 * Mint an unreferenced commit and read it back through the same `git log`
 * format the real gates parse, so the matcher is exercised against the plumbing
 * it actually faces rather than against a hand-built string.
 *
 * Nothing points at the object, so it is unreachable from every ref: git
 * collects it, and an unreachable object is never pushed.
 */
function specimen(message, who = {}) {
  const name = who.name || "unlazy specimen";
  const email = who.email || "specimen@example.invalid";
  const sha = git(["commit-tree", EMPTY_TREE, "-m", message], {
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: name,
      GIT_AUTHOR_EMAIL: email,
      GIT_COMMITTER_NAME: name,
      GIT_COMMITTER_EMAIL: email,
    },
  }).trim();
  return git(["log", "-1", "--format=%an <%ae>%n%cn <%ce>%n%B", sha]);
}

/**
 * Prove the matchers still fire. Fails loudly; returns a one-line summary for
 * the caller's success token.
 *
 * Both matchers are exercised SEPARATELY. A combined check would let one rot
 * behind the other: IDENTITY had no control of its own before this, though
 * G1 and G5 both rely on it.
 */
export function assertMatcherWorks() {
  const trailerBlob = specimen(`specimen\n\n${TRAILER_KEY}: Claude <${BOT_EMAIL}>\n`);
  const identityBlob = specimen("specimen\n\nno trailer in this message\n",
    { name: "Claude", email: BOT_EMAIL });
  const cleanBlob = specimen("specimen\n\nno attribution of any kind\n");

  const wrong = [];
  if (!TRAILER.test(trailerBlob)) wrong.push("TRAILER missed a real trailer");
  if (!IDENTITY.test(identityBlob)) wrong.push("IDENTITY missed the bot email");
  if (hasAttribution(cleanBlob)) wrong.push("a clean commit was flagged as attributed");
  if (wrong.length) {
    fail(
      "the attribution matcher is broken: " + wrong.join("; ") +
      ". Every absence result that depends on it is meaningless until this passes.",
    );
  }
  return "trailer=hit identity=hit clean=miss";
}

export function selftest() {
  console.log("MATCHER_SELFTEST_OK " + assertMatcherWorks());
}

// Only run as a CLI when invoked directly; importing must not execute anything.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] !== "selftest") {
    console.error("usage: .unlazy-attribution.mjs selftest");
    process.exit(2);
  }
  selftest();
}
