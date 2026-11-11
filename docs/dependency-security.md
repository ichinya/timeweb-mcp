# Production dependency security review — issue #29

## Scope and reproducible evidence

Reviewed on 2026-11-10 with Node.js 24.13.0 and npm 11.18.0, starting from
`06f885505b83a380b33061a122786ea547eee5ea` plus the pending #28 verification scripts.
This is a dated assessment of the production dependency tree, not a guarantee
that the application has no vulnerabilities.

`npm audit --omit=dev --json` returned exit 0, an empty `vulnerabilities` object,
and zero findings at every severity both before and after the update:

- Before: 2026-11-10T18:37:29Z (baseline capture started);
  lockfile SHA-256 `c1244ba5b315f29897f08c516174d2fe055989b2e0b14a95df1f69d830d0473e`.
- After: 2026-11-10T18:38:52Z;
  lockfile SHA-256 `484ef981765b7bef37ac66255898da19a95794bcb0c8c6a7a814a056fec1e022`.

The original report contained 16 affected **package entries**, including parents
affected through their dependencies. That count is not a count of independent
advisories. Earlier dependency upgrades (commit `618a4e3`) already replaced the
original SDK/Axios/Zod versions. No further SDK/Zod migration or audit exception
was needed for this change.

Full before/after audit JSON, stderr, exit codes, runtime/HEAD/hash metadata,
the baseline diff and verification log are supporting artifacts under
`.bb/chats/thr_zvavh59e6i/artifacts/issue29-*`. The historical source is
`npm-audit.json` in that directory; its derived review is
`issue29-historical-chain-review.json`. These local evidence files are not a
substitute for rerunning the commands against a later lockfile or advisory database.

## Targeted update

Axios changed from 1.21.0 to 1.21.1, with root range `^1.21.1`.
The [official release notes](https://github.com/axios/axios/releases/tag/v1.21.1)
raise its minimum follow-redirects range from `^1.16.0` to `^1.16.2` without API
changes. The resolved follow-redirects version remains 1.16.3. Therefore this is
preventive minimum-version hardening; the baseline tree did not have an active
finding for this advisory.

[GHSA-mrwp-f3q8-3g9p](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p)
affects follow-redirects 1.16.0–1.16.1 and is patched in 1.16.2. Its cross-realm
`sensitiveHeaders` condition concerns custom credentials and cross-origin redirects;
the existence of Axios in the tree alone does not demonstrate exploitation.
The project's [HTTP client](../src/api/client.ts) performs outbound requests,
so redirect handling remains a relevant dependency path to maintain.

The lockfile delta contains only the root Axios range and the Axios package
record (version, tarball integrity and follow-redirects range). SDK 1.32.2,
dotenv 18.0.10, Zod 4.6.7, all devDependencies and package version 0.1.8 remain
unchanged. No `audit fix`, force update, overrides or audit-level suppression
was used.

## Reachability assessment

- [src/index.ts](../src/index.ts) constructs the MCP server and connects
  `StdioServerTransport`. The deployed entrypoint does not configure an HTTP
  server transport, OAuth server or trusted proxy.
- [src/register-tools.ts](../src/register-tools.ts) registers tool schemas;
  Zod and the SDK's validation/conversion paths are relevant to MCP input.
  SDK `server/index.js` constructs `AjvJsonSchemaValidator` by default, whose
  provider loads ajv-formats. Exact attacker reachability of every Ajv/fast-uri
  advisory branch is **UNKNOWN** from this static review.
- Express/Hono HTTP middleware and SDK OAuth/experimental task features are
  not configured by this entrypoint. This limits the identified paths; it does
  not prove that every dependency module is absent from the bundle or that a
  future transport change would be safe.
- A fixed package version and an unreachable vulnerable code path are separate
  conclusions. No exploitation test or production cloud call was performed.

## Historical package entries

The following entries preserve every historical `via` relationship. Linked
advisories and affected ranges come from the saved npm report; a package-name
`via` denotes an inherited finding whose advisory is listed under that package.
All entries have **no active finding in the fresh production audit**. Versions
refer to the final lockfile. No historical finding is accepted as a permanent
exception.

### 1. @hono/node-server 2.1.6

HTTP/middleware dependency path; the corresponding server/proxy features are not configured in the stdio entrypoint.

- [GHSA-frvp-7c67-39w9](https://github.com/advisories/GHSA-frvp-7c67-39w9): historical affected range `<1.19.15`.
- [GHSA-rmxm-3fg6-px4f](https://github.com/advisories/GHSA-rmxm-3fg6-px4f): historical affected range `>=1.19.10 <2.1.3`.
- Inherited via `hono`; see its entry below/above.

### 2. @modelcontextprotocol/sdk 1.32.2

MCP server/stdio is used. Reachability of individual HTTP/OAuth/task-specific advisory paths is not established by package presence.

- Inherited via `@hono/node-server`; see its entry below/above.
- [GHSA-6qxp-vccf-f47h](https://github.com/advisories/GHSA-6qxp-vccf-f47h): historical affected range `>=1.12.0 <1.31.0`.
- [GHSA-22jm-h49p-29qw](https://github.com/advisories/GHSA-22jm-h49p-29qw): historical affected range `>=1.24.0 <1.32.0`.
- [GHSA-46jr-4wx8-v453](https://github.com/advisories/GHSA-46jr-4wx8-v453): historical affected range `>=1.3.0 <1.32.0`.
- [GHSA-rvq5-wwqv-78pq](https://github.com/advisories/GHSA-rvq5-wwqv-78pq): historical affected range `>=1.6.0 <1.32.0`.
- [GHSA-f897-62hf-6gxq](https://github.com/advisories/GHSA-f897-62hf-6gxq): historical affected range `>=1.10.0 <1.30.1`.
- [GHSA-6prh-2h8m-c8cw](https://github.com/advisories/GHSA-6prh-2h8m-c8cw): historical affected range `<1.32.0`.
- Inherited via `ajv`; see its entry below/above.
- Inherited via `ajv-formats`; see its entry below/above.
- Inherited via `express`; see its entry below/above.
- Inherited via `express-rate-limit`; see its entry below/above.
- Inherited via `hono`; see its entry below/above.
- Inherited via `zod`; see its entry below/above.
- Inherited via `zod-to-json-schema`; see its entry below/above.

### 3. ajv 8.20.0

Schema validation/conversion dependency path. Zod schemas are used; exact reachability of individual converter/URI-parser advisory branches is UNKNOWN.

- Inherited via `fast-uri`; see its entry below/above.

### 4. ajv-formats 3.0.1

Schema validation/conversion dependency path. Zod schemas are used; exact reachability of individual converter/URI-parser advisory branches is UNKNOWN.

- Inherited via `ajv`; see its entry below/above.

### 5. axios 1.21.1

Outbound HTTP dependency path used by the API client. Fixed versions do not imply that redirect code is unused.

- [GHSA-vh66-26gq-q6x8](https://github.com/advisories/GHSA-vh66-26gq-q6x8): historical affected range `>=1.7.0 <1.20.0`.
- [GHSA-9fr6-4gfg-395g](https://github.com/advisories/GHSA-9fr6-4gfg-395g): historical affected range `>=1.0.0 <1.20.0`.
- [GHSA-c29m-xwm3-cm6r](https://github.com/advisories/GHSA-c29m-xwm3-cm6r): historical affected range `>=1.16.1 <1.20.0`.
- [GHSA-mghh-pgcx-3jjj](https://github.com/advisories/GHSA-mghh-pgcx-3jjj): historical affected range `>=1.15.0 <1.20.0`.
- [GHSA-x97p-jq2g-jp4f](https://github.com/advisories/GHSA-x97p-jq2g-jp4f): historical affected range `>=1.15.1 <1.20.0`.
- [GHSA-3pq3-5fj3-cg6v](https://github.com/advisories/GHSA-3pq3-5fj3-cg6v): historical affected range `>=1.13.0 <1.20.0`.
- [GHSA-542g-h47m-68v8](https://github.com/advisories/GHSA-542g-h47m-68v8): historical affected range `>=1.13.0 <1.20.0`.
- [GHSA-j8rh-479h-cp32](https://github.com/advisories/GHSA-j8rh-479h-cp32): historical affected range `>=1.0.0 <1.20.0`.
- [GHSA-4hqw-qxg8-jxx2](https://github.com/advisories/GHSA-4hqw-qxg8-jxx2): historical affected range `>=1.12.0 <1.20.0`.
- [GHSA-m8m8-qj5v-23w3](https://github.com/advisories/GHSA-m8m8-qj5v-23w3): historical affected range `>=1.15.2 <1.20.0`.
- [GHSA-44g4-m2mj-wpvx](https://github.com/advisories/GHSA-44g4-m2mj-wpvx): historical affected range `>=1.15.0 <1.20.0`.
- [GHSA-r4gj-5m52-g5wh](https://github.com/advisories/GHSA-r4gj-5m52-g5wh): historical affected range `>=1.17.0 <1.20.0`.
- Inherited via `follow-redirects`; see its entry below/above.

### 6. body-parser 2.4.0

HTTP/middleware dependency path; the corresponding server/proxy features are not configured in the stdio entrypoint.

- [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828): historical affected range `>=2.0.0 <2.4.0`.
- Inherited via `qs`; see its entry below/above.

### 7. express 5.3.0

HTTP/middleware dependency path; the corresponding server/proxy features are not configured in the stdio entrypoint.

- Inherited via `body-parser`; see its entry below/above.
- Inherited via `proxy-addr`; see its entry below/above.
- Inherited via `qs`; see its entry below/above.

### 8. express-rate-limit 8.7.3

HTTP/middleware dependency path; the corresponding server/proxy features are not configured in the stdio entrypoint.

- Inherited via `express`; see its entry below/above.
- Inherited via `ip-address`; see its entry below/above.

### 9. fast-uri 3.1.9

Schema validation/conversion dependency path. Zod schemas are used; exact reachability of individual converter/URI-parser advisory branches is UNKNOWN.

- [GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx): historical affected range `>=3.0.0 <=3.1.3`.
- [GHSA-7p8r-x3mc-p8w7](https://github.com/advisories/GHSA-7p8r-x3mc-p8w7): historical affected range `>=3.0.0 <3.1.5`.
- [GHSA-5jgf-p345-68v8](https://github.com/advisories/GHSA-5jgf-p345-68v8): historical affected range `>=3.1.3 <3.1.6`.
- [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc): historical affected range `>=3.0.0 <3.1.6`.
- [GHSA-fph4-wmhf-6fwf](https://github.com/advisories/GHSA-fph4-wmhf-6fwf): historical affected range `>=3.1.2 <3.1.6`.
- [GHSA-jqff-g426-hqxp](https://github.com/advisories/GHSA-jqff-g426-hqxp): historical affected range `>=3.0.0 <3.1.6`.
- [GHSA-qw65-cvwx-89v3](https://github.com/advisories/GHSA-qw65-cvwx-89v3): historical affected range `>=3.0.0 <3.1.7`.
- [GHSA-hrr3-gc8f-f4qj](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj): historical affected range `>=3.0.0 <3.1.8`.
- [GHSA-w74x-v6f9-j3xg](https://github.com/advisories/GHSA-w74x-v6f9-j3xg): historical affected range `>=3.0.0 <3.1.9`.
- [GHSA-xhq7-xmqj-769h](https://github.com/advisories/GHSA-xhq7-xmqj-769h): historical affected range `>=3.0.0 <3.1.9`.
- [GHSA-wjr9-j795-jxcr](https://github.com/advisories/GHSA-wjr9-j795-jxcr): historical affected range `>=3.1.3 <3.1.9`.
- [GHSA-333x-w4r6-6crp](https://github.com/advisories/GHSA-333x-w4r6-6crp): historical affected range `>=3.0.0 <3.1.9`.

### 10. follow-redirects 1.16.3

Outbound HTTP dependency path used by the API client. Fixed versions do not imply that redirect code is unused.

- [GHSA-q3jh-wrc6-jgq8](https://github.com/advisories/GHSA-q3jh-wrc6-jgq8): historical affected range `>=1.16.0 <1.16.1`.
- [GHSA-8r9p-f939-6h3c](https://github.com/advisories/GHSA-8r9p-f939-6h3c): historical affected range `>=1.16.0 <1.16.1`.
- [GHSA-mrwp-f3q8-3g9p](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p): historical affected range `>=1.16.0 <=1.16.1`.

### 11. hono 4.13.17

HTTP/middleware dependency path; the corresponding server/proxy features are not configured in the stdio entrypoint.

- [GHSA-8j4g-w8fx-2239](https://github.com/advisories/GHSA-8j4g-w8fx-2239): historical affected range `<4.12.34`.
- [GHSA-f23p-vx2j-j53r](https://github.com/advisories/GHSA-f23p-vx2j-j53r): historical affected range `>=3.8.0 <4.12.34`.
- [GHSA-79qm-7rj5-m7r9](https://github.com/advisories/GHSA-79qm-7rj5-m7r9): historical affected range `>=4.7.0 <4.12.34`.
- [GHSA-54fx-42gc-7vw4](https://github.com/advisories/GHSA-54fx-42gc-7vw4): historical affected range `>=4.12.0 <4.12.34`.
- [GHSA-gqvv-2mrq-wpjv](https://github.com/advisories/GHSA-gqvv-2mrq-wpjv): historical affected range `<4.13.5`.
- [GHSA-g6gw-c38x-mqfc](https://github.com/advisories/GHSA-g6gw-c38x-mqfc): historical affected range `<4.13.5`.
- [GHSA-crvj-82cr-hjcx](https://github.com/advisories/GHSA-crvj-82cr-hjcx): historical affected range `<4.13.5`.
- [GHSA-hxh3-vqpv-xpqv](https://github.com/advisories/GHSA-hxh3-vqpv-xpqv): historical affected range `<4.13.7`.
- [GHSA-5r4p-p66f-jhc7](https://github.com/advisories/GHSA-5r4p-p66f-jhc7): historical affected range `>=4.12.4 <4.13.11`.

### 12. ip-address 10.7.6

HTTP/middleware dependency path; the corresponding server/proxy features are not configured in the stdio entrypoint.

- [GHSA-mwp4-54f8-5fhr](https://github.com/advisories/GHSA-mwp4-54f8-5fhr): historical affected range `<=10.3.0`.
- [GHSA-4xrf-jv44-h6hh](https://github.com/advisories/GHSA-4xrf-jv44-h6hh): historical affected range `>=10.1.1 <=10.2.1`.
- [GHSA-22jq-vg5j-6vgg](https://github.com/advisories/GHSA-22jq-vg5j-6vgg): historical affected range `>=10.1.1 <=10.2.0`.
- [GHSA-rpw4-54j3-4h4q](https://github.com/advisories/GHSA-rpw4-54j3-4h4q): historical affected range `<=10.5.0`.
- [GHSA-2vr4-cq9g-pvrc](https://github.com/advisories/GHSA-2vr4-cq9g-pvrc): historical affected range `>=10.2.0 <=10.5.0`.
- [GHSA-j6r3-76f7-8jcv](https://github.com/advisories/GHSA-j6r3-76f7-8jcv): historical affected range `<=10.7.0`.
- [GHSA-h3mg-xc3c-68pw](https://github.com/advisories/GHSA-h3mg-xc3c-68pw): historical affected range `<=10.7.0`.
- [GHSA-rxp7-6hxx-x8q5](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5): historical affected range `<=10.7.3`.

### 13. proxy-addr 2.0.8

HTTP/middleware dependency path; the corresponding server/proxy features are not configured in the stdio entrypoint.

- [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h): historical affected range `>=1.1.0 <2.0.8`.

### 14. qs 6.17.1

HTTP/middleware dependency path; the corresponding server/proxy features are not configured in the stdio entrypoint.

- [GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx): historical affected range `>=6.14.2 <=6.15.3`.
- [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g): historical affected range `>=2.2.5 <6.16.0`.
- [GHSA-6pq8-jhm2-2vcw](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw): historical affected range `>=6.7.0 <=6.16.0`.

### 15. zod 4.6.7

Schema validation/conversion dependency path. Zod schemas are used; exact reachability of individual converter/URI-parser advisory branches is UNKNOWN.

- [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5): historical affected range `<4.6.6`.

### 16. zod-to-json-schema 3.25.2

Schema validation/conversion dependency path. Zod schemas are used; exact reachability of individual converter/URI-parser advisory branches is UNKNOWN.

- Inherited via `zod`; see its entry below/above.

## Validation and limits

`npm ls --omit=dev --depth=0` and the focused `npm ls --omit=dev axios follow-redirects zod proxy-addr @modelcontextprotocol/sdk --all` both exited 0. They confirm installed Axios 1.21.1, follow-redirects 1.16.3, proxy-addr 2.0.8 and deduplicated Zod 4.6.7.

[Zod GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) affects versions below 4.6.6; [proxy-addr GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) affects versions from 1.1.0 below 2.0.8. The locked versions are outside those ranges, as follow-redirects 1.16.3 is outside the cross-realm advisory range above.

`npm run verify`, with an explicitly empty TIMEWEB_TOKEN and restoration of the previous process environment, exited 0: OpenAPI validation (336 paths, 514 operations), route gate (286 routes, 10 explicit exceptions, 0 unknown), 6 OpenAPI tests, 5 release tests, TypeScript, 116 transport/API/MCP tests, build and both startup/resource-registration smoke tests passed. No source or test change was needed.

Clean installation in a separate environment, GitHub CI, other operating systems/runtimes and production: NOTRUN. Exploitability of untraced advisory branches: UNKNOWN, not an audit exception. No CI or production PASS is inferred from local tests. Repeat the audit after dependency/lockfile or transport changes and when new advisories appear.
