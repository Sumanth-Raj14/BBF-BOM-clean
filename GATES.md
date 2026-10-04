# Gates: BBF-BOM-clean migration is actually complete

OWNS: GATES.md, .unlazy-checks.mjs, .unlazy-migration-check.mjs, .unlazy-attribution.mjs

Scope: prove the claims I made about the migration to
`Sumanth-Raj14/BBF-BOM-clean` — attribution clean across EVERY reachable ref
(the pass that first missed the tags), the old content imported intact,
tags on the clean lineage, no inherited PR refs, and branch protection live.

Baseline that makes the absence checks meaningful: before the retag, all three
tags resolved to pre-rewrite commits that DID carry Claude trailers, and a
scan that only walked `master` reported clean. G1 therefore walks tags too.

- [x] G0: the ONE attribution matcher every gate imports still fires on a trailer and on the bot identity, and not on a clean commit
  CHECK: node .unlazy-attribution.mjs selftest
  EXPECT: MATCHER_SELFTEST_OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=20c3298c74751f9eaac82118730b0697f4f112e5d8b23542483a687a77e0a6f5; exit=0; EXPECT=matched; output-sha256=0aaac530c7a19f06e066f6607a21b5adb0d65d9bbb5609ca0029fb269f5385b5; output-bytes=56; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\tsuma\Downloads\bom tool\bom tool v1\bom-tool; path=6b48680b9ee6/78 entries

- [x] G1: zero Claude/Anthropic attribution across EVERY ref of the clean repo
  CHECK: node .unlazy-migration-check.mjs attribution
  EXPECT: CLEAN_ALL_REFS
  EVIDENCE: automatic-evidence=v1; definition-sha256=610b5feb60e6c65846e0b18a6c5303d143d1c05e53c99e587465c3622dddef4d; exit=0; EXPECT=matched; output-sha256=671487fe372014c01f1c8a1a32da696f66cc2ee788326f0080a19339e4611931; output-bytes=79; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\tsuma\Downloads\bom tool\bom tool v1\bom-tool; path=6b48680b9ee6/78 entries

- [x] G2: Sumanth-Raj-BBF is the only author anywhere in the clean repo
  CHECK: node .unlazy-migration-check.mjs authors
  EXPECT: SOLE_AUTHOR_ALL_REFS
  EVIDENCE: automatic-evidence=v1; definition-sha256=78b687f88e84252fbf06d72079d612d90aedaf3944755242f1184c405d28a750; exit=0; EXPECT=matched; output-sha256=edfb8487d002c391833ee49b6f37e990e5a560b912be31ee2a6f09cff60b459b; output-bytes=31; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\tsuma\Downloads\bom tool\bom tool v1\bom-tool; path=6b48680b9ee6/78 entries

- [x] G3: the old master tree survives byte-identical as an ancestor of the clean master
  CHECK: node .unlazy-migration-check.mjs content
  EXPECT: IMPORT_INTACT
  EVIDENCE: automatic-evidence=v1; definition-sha256=8daa236faf61635a328a62cfa8bd870c0b5110f8b423aea5c7d707ccfd8d53d9; exit=0; EXPECT=matched; output-sha256=e3c85e6a17ddbb987e3404190b26ebee97ec878f83dfbce347eae23565110279; output-bytes=61; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\tsuma\Downloads\bom tool\bom tool v1\bom-tool; path=6b48680b9ee6/78 entries

- [x] G4: every tag resolves onto the clean master lineage, not pre-rewrite history
  CHECK: node .unlazy-migration-check.mjs tags
  EXPECT: TAGS_ON_LINEAGE
  EVIDENCE: automatic-evidence=v1; definition-sha256=6094e70575e71c600077dc44a920f11de2446ef7837e5dcf6d7d4181f53cfa8c; exit=0; EXPECT=matched; output-sha256=2b80c5a05a6ac468e1e77c27b2d5cfd7b2f35209c022fd82a933d6c13412afef; output-bytes=23; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\tsuma\Downloads\bom tool\bom tool v1\bom-tool; path=6b48680b9ee6/78 entries

- [x] G5: no PR ref on the clean repo carries Claude attribution
  CHECK: node .unlazy-migration-check.mjs pullrefs
  EXPECT: PULL_REFS_CLEAN
  EVIDENCE: automatic-evidence=v1; definition-sha256=b30416ef184e66b10570381c3916f464107ae226348d54dcb98f74d1ad25e6f5; exit=0; EXPECT=matched; output-sha256=3e97306dab591e73e8da7c76d96e37c66b974ddc07b0d168eb3db0355d2d9940; output-bytes=76; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\tsuma\Downloads\bom tool\bom tool v1\bom-tool; path=6b48680b9ee6/78 entries

- [x] G6: every ref migrated from the old repo (pinned inventory of 6) still exists on the clean repo
  CHECK: node .unlazy-migration-check.mjs refparity
  EXPECT: REF_PARITY_OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=786c16feea2f904ce86f3163cf0d0053e99b7173345fb0c7e3d3501c0b2f10f6; exit=0; EXPECT=matched; output-sha256=e8a61b85def14f7fe8de3aaf8891a6c8410072b6ed3f214557f7508dca346b11; output-bytes=24; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\tsuma\Downloads\bom tool\bom tool v1\bom-tool; path=6b48680b9ee6/78 entries

- [x] G7: branch protection on the clean master enforces all 9 required checks BY NAME, strict, no force-push, no deletion
  CHECK: node .unlazy-migration-check.mjs protection
  EXPECT: PROTECTION_OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=63dc3c043514990873f2d0e155710f8dd28dda583b2eb0e0a52da496264f99ab; exit=0; EXPECT=matched; output-sha256=03669763a40af4ae8c3c32035fb21f9eef1630313083c485a6d62e4b4b44707c; output-bytes=75; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\tsuma\Downloads\bom tool\bom tool v1\bom-tool; path=6b48680b9ee6/78 entries

- [x] G8: no Claude/Anthropic contributor on the clean repo; every contributor is on the named allowlist
  CHECK: node .unlazy-migration-check.mjs contributors
  EXPECT: NO_BOT_CONTRIBUTOR
  EVIDENCE: automatic-evidence=v1; definition-sha256=71065fa9d966ab22f7b5c0e5921ceec1381b9a7d6b02e6779e901992ec262160; exit=0; EXPECT=matched; output-sha256=a7b6126e4b27af3608dfbe43517c7b121508eca79c0374b1f70ee155cea9782f; output-bytes=56; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\tsuma\Downloads\bom tool\bom tool v1\bom-tool; path=6b48680b9ee6/78 entries

- [ ] G9: saisasivardhan-bb has write access (invitation accepted)
  EVIDENCE: pending

- [ ] G10: old repo retired and BBF-BOM-clean renamed to BBF-BOM
  EVIDENCE: pending

<!--
G9 and G10 are manual because neither is mine to complete: an invitation is
accepted by the invitee, and deleting a repository is an owner action the API
will not let me perform on the user's behalf. They are surfaced as handoffs
rather than dropped, so the ledger cannot read as finished while they are open.

G1 deliberately walks tags and branches, not just master. The earlier pass
walked master alone, reported clean, and missed that all three tags pointed at
pre-rewrite commits carrying trailers — the exact defect that would have made
the migration pointless.

G3 compares blob hashes rather than file counts: equal counts with different
contents would pass a count check and lose data silently.

G3 originally required the clean master tree to EQUAL the old master tree.
Like G5, that was a fair proxy on migration day and expired the moment work
was merged here: it reported our own merged PRs as damage (extra:14
changed:14). It now requires the old master tree to exist byte-identical as
an ANCESTOR of the clean master, which cannot expire -- later commits add
descendants without altering that ancestor -- and is strictly stronger, since
it proves the whole old repo arrived rather than that today's files still
overlap it. Drift since the import is reported, never failed on, and a
genuinely absent tree (git's empty tree) is checked to be unfindable so that
"found" is not vacuous.

Audit after G3: four more gates had the same expiring-proxy shape, and one
failed in the opposite, quieter direction.

* G0, G3, G5, G6 read the OLD repo live. G10 deletes it AND renames this repo
  to BBF-BOM, which makes the `origin` URL resolve to THIS repo -- so G3 would
  have compared the clean repo with itself and G6 its refs with its own, both
  printing PASS while measuring nothing. The migration-day facts are now pinned
  by hash (tree 0dce386b, 1139 files, 6 ref names) and there is no OLD_REMOTE
  constant left to reach the old repo with. The control is hermetic: it mints
  an unreferenced commit with `git commit-tree` and reads it back through the
  same `git log` format the gates parse.
* G0 certified a COPY of the matcher that G1/G2/G5 did not use (two identical
  regexes in two files). There is now one exported definition in
  .unlazy-attribution.mjs, imported by the migration checker, and the control
  exercises TRAILER and IDENTITY separately so neither can rot behind the
  other. .unlazy-checks.mjs is the pre-migration scrub tooling and is no
  longer a gate.
* G7 compared the COUNT of required checks (9), so it failed if a tenth was
  added -- protection getting stronger -- and passed if all nine were swapped
  for junk. It now requires the nine NAMES to be present.
* G8 demanded exactly one contributor, which would have failed the first time
  the collaborator G9 exists to onboard landed a commit. It now fails on any
  Claude/Anthropic contributor unconditionally, then on anyone off a named
  allowlist.
* G1/G2 failed on a fresh clone with "run: git fetch clean --tags", which does
  not fetch refs/pull/*. They now fetch whatever is missing themselves.

G5 originally asserted the clean repo had ZERO refs/pull/*. That was a fair
proxy on migration day -- the repo had no PRs of its own, so any PR ref could
only have been inherited -- but it expired the moment PR #1 was opened here,
and then reported FAIL for two refs created by our own clean merges. It now
asserts the property that actually matters: no PR ref reaches a commit
carrying attribution. PR refs are immutable, so one tainted head is permanent,
which is precisely why the old repo could not be cleaned in place.
-->
