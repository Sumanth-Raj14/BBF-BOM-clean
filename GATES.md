# Gates: BBF-BOM-clean migration is actually complete

OWNS: GATES.md, .unlazy-checks.mjs, .unlazy-migration-check.mjs

Scope: prove the claims I made about the migration to
`Sumanth-Raj14/BBF-BOM-clean` — attribution clean across EVERY reachable ref
(the pass that first missed the tags), the old content imported intact,
tags on the clean lineage, no inherited PR refs, and branch protection live.

Baseline that makes the absence checks meaningful: before the retag, all three
tags resolved to pre-rewrite commits that DID carry Claude trailers, and a
scan that only walked `master` reported clean. G1 therefore walks tags too.

- [x] G0: the attribution matcher can still detect a real trailer (positive control)
  CHECK: node .unlazy-checks.mjs control
  EXPECT: CONTROL_DETECTS_TRAILER
  EVIDENCE: automatic-evidence=v1; definition-sha256=aaf8ef4d017901b38186ddce91bf69cdfb6e5ba2ec08d221f8570aa0d540a626; exit=0; EXPECT=matched; output-sha256=0d769c1c58e850b9ce9274b377c9d4db234b7fb152dc575883c78335c01acc1c; output-bytes=50; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\tsuma\Downloads\bom tool\bom tool v1\bom-tool; path=6b48680b9ee6/78 entries

- [x] G1: zero Claude/Anthropic attribution across EVERY ref of the clean repo
  CHECK: node .unlazy-migration-check.mjs attribution
  EXPECT: CLEAN_ALL_REFS
  EVIDENCE: automatic-evidence=v1; definition-sha256=610b5feb60e6c65846e0b18a6c5303d143d1c05e53c99e587465c3622dddef4d; exit=0; EXPECT=matched; output-sha256=17ac041b6e67bc84630004d7c070230c98e927495d883d49e62e8fa4440c0584; output-bytes=34; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\tsuma\Downloads\bom tool\bom tool v1\bom-tool; path=6b48680b9ee6/78 entries

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
  EVIDENCE: automatic-evidence=v1; definition-sha256=b30416ef184e66b10570381c3916f464107ae226348d54dcb98f74d1ad25e6f5; exit=0; EXPECT=matched; output-sha256=da1ffd6d4e6793740e5a25c307b2f4eec18a611e66edfbbb37d1c00825df6786; output-bytes=71; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\tsuma\Downloads\bom tool\bom tool v1\bom-tool; path=6b48680b9ee6/78 entries

- [x] G6: every non-pull ref on the old repo exists on the clean repo
  CHECK: node .unlazy-migration-check.mjs refparity
  EXPECT: REF_PARITY_OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=786c16feea2f904ce86f3163cf0d0053e99b7173345fb0c7e3d3501c0b2f10f6; exit=0; EXPECT=matched; output-sha256=e8a61b85def14f7fe8de3aaf8891a6c8410072b6ed3f214557f7508dca346b11; output-bytes=24; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\tsuma\Downloads\bom tool\bom tool v1\bom-tool; path=6b48680b9ee6/78 entries

- [x] G7: branch protection on the clean master is live with 9 required checks
  CHECK: node .unlazy-migration-check.mjs protection
  EXPECT: PROTECTION_OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=63dc3c043514990873f2d0e155710f8dd28dda583b2eb0e0a52da496264f99ab; exit=0; EXPECT=matched; output-sha256=b1c90c5d329a3607307281afe5ffe69f1602d0b91f0ce5e378fbc29248c642e6; output-bytes=65; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\tsuma\Downloads\bom tool\bom tool v1\bom-tool; path=6b48680b9ee6/78 entries

- [x] G8: GitHub reports exactly one contributor on the clean repo
  CHECK: node .unlazy-migration-check.mjs contributors
  EXPECT: ONE_CONTRIBUTOR
  EVIDENCE: automatic-evidence=v1; definition-sha256=1604ea25b853a4385c3d39a4a276fe2bc63b2bc92b03fc407dc21cdb3e740f50; exit=0; EXPECT=matched; output-sha256=800514e275a39ed196df0c3598e75f3dac35e4bdac613742ed7389c877ff77bd; output-bytes=42; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\tsuma\Downloads\bom tool\bom tool v1\bom-tool; path=6b48680b9ee6/78 entries

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

G5 originally asserted the clean repo had ZERO refs/pull/*. That was a fair
proxy on migration day -- the repo had no PRs of its own, so any PR ref could
only have been inherited -- but it expired the moment PR #1 was opened here,
and then reported FAIL for two refs created by our own clean merges. It now
asserts the property that actually matters: no PR ref reaches a commit
carrying attribution. PR refs are immutable, so one tainted head is permanent,
which is precisely why the old repo could not be cleaned in place.
-->
