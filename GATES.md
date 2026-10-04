# Gates: BBF-BOM-clean migration is actually complete

OWNS: GATES.md, .unlazy-checks.mjs, .unlazy-migration-check.mjs

Scope: prove the claims I made about the migration to
`Sumanth-Raj14/BBF-BOM-clean` — attribution clean across EVERY reachable ref
(the pass that first missed the tags), content identical to the old master,
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

- [x] G3: clean master is byte-identical to old master (no content lost)
  CHECK: node .unlazy-migration-check.mjs content
  EXPECT: CONTENT_IDENTICAL
  EVIDENCE: automatic-evidence=v1; definition-sha256=31b8bb4edff94803df15c2b0a4302aab5f9dc6991472c7e41592092d3a8dd7e9; exit=0; EXPECT=matched; output-sha256=c6867cbefba2a61c725d7947204100c568b0a6d74e8d94c967482598c2133911; output-bytes=29; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\tsuma\Downloads\bom tool\bom tool v1\bom-tool; path=6b48680b9ee6/78 entries

- [x] G4: every tag resolves onto the clean master lineage, not pre-rewrite history
  CHECK: node .unlazy-migration-check.mjs tags
  EXPECT: TAGS_ON_LINEAGE
  EVIDENCE: automatic-evidence=v1; definition-sha256=6094e70575e71c600077dc44a920f11de2446ef7837e5dcf6d7d4181f53cfa8c; exit=0; EXPECT=matched; output-sha256=2b80c5a05a6ac468e1e77c27b2d5cfd7b2f35209c022fd82a933d6c13412afef; output-bytes=23; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\tsuma\Downloads\bom tool\bom tool v1\bom-tool; path=6b48680b9ee6/78 entries

- [x] G5: the clean repo inherited no refs/pull/* (the reason it is clean)
  CHECK: node .unlazy-migration-check.mjs nopulls
  EXPECT: NO_PULL_REFS
  EVIDENCE: automatic-evidence=v1; definition-sha256=1b91bdc0a0d84f36a8d0bc1354c807668fd72f4fe59695de4e4d44e94ae7d5dd; exit=0; EXPECT=matched; output-sha256=c87d34d728c0de8cc9676086b14b7dd6f1923588fc33e90fc03fc0ed4d0c5a8d; output-bytes=34; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\tsuma\Downloads\bom tool\bom tool v1\bom-tool; path=6b48680b9ee6/78 entries

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
-->
