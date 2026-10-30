# Bridge Street Licensing Desk

A working local demo for a fictional four-person application-preparation office. Track accountable tasks, deficiencies, stage blockers, handoffs, and editable follow-up drafts. All records are synthetic. The Sample Business Permit workflow describes no jurisdiction's law.

## Run

Requires Node.js 24 or later. No packages, API keys, paid services, or network access are required.

```sh
npm start
```

Open http://127.0.0.1:4173. Optional environment variables are documented in `.env.example`; Node does not automatically load that file. Use `node --env-file=.env server.ts` if you create one.

```sh
npm test
# With a disposable demo server running on port 4173:
node integration.ts
```

**The integration suite resets the demo database.** Do not run it against records you want to retain. It restores the original seed when successful.

## Operator guide

- Today shows overdue, due within seven days, unassigned, blocked, and awaiting-response tasks from active applications. Dates use America/New_York. Overlapping categories intentionally count the same task.
- Applications identifies records by unique reference, not business/contact name. Create an application to instantiate the latest immutable workflow version.
- Open Harbor & Pine Studio, SBP-2026-001. Its intake tasks are completed but proof of business address blocks advancement. An explicit supervisor override records a reason and leaves the deficiency visible.
- Update a task to change its state, owner, or date. Owner changes require a handoff note. Blocked tasks must reopen before completion. Dependencies must complete first.
- Review deficiency responses and record a resolution note before verification.
- Generate a follow-up, edit its wording, choose a recipient, save, and export text. Nothing sends mail. No client email is invented.
- Record document, mailing, or payment references; no uploads, portal submission, or payment processing occurs.
- Export the full JSON record or outstanding text checklist before resetting. Reset affects the demo organization only.
- When a save reports a stale record, reload and reapply the intended change. The conflicting write is rejected, not silently merged.

## Storage and boundaries

Node's native TypeScript stripping and SQLite keep this application dependency-free and maintainable. Server domain rules live in `domain.ts` and `server.ts`; the browser uses small native JavaScript modules. Schema is initialized idempotently on first launch; see `docs/model.md`. The local SQLite database persists across reloads and process restarts and is excluded from source control.

This is a loopback-only, single-organization demo. Taylor is a fixed demo supervisor; there is no real authentication or production authorization. Reads and writes scope to the demo organization and record saves use compare-and-swap revisions. Do not expose this server publicly or enter private client records. Publishing the source does not make the running app a hosted service.

All imported-looking references are inert escaped text. There are no connectors, model calls, or credential stores. External adapters are deferred. Files have no automatic expiry: records remain until reset or deletion of the local database; exports remain wherever downloaded. There is no compliance certification or remote backup. Manual database backup must be taken while the server is stopped.

## Verification performed

The initial domain and HTTP checks passed; consult the current GitHub Actions runs for the latest revision. Live HTTP checks passed for seed counts (15 applications, 40 tasks, 10 deficiencies, 3 overdue tasks, 2 unassigned tasks), correct-record drafting, stage blocker/override, handoff reload persistence, stale-edit rejection (409), immutable template snapshots, unknown-record rejection, and create/reference uniqueness validation. Desktop browser verification confirmed Today, application workspace, and generation of the correct address request. Mobile CSS is implemented but device-level testing remains pending.

## Implementation status

- [x] Application creation, tasks, state transitions, ownership and deadlines
- [x] Persistent SQLite records and optimistic concurrency protection
- [x] Deficiency response, verification and resolution
- [x] Today and application workspace
- [x] Explicit override history and task/application handoffs
- [x] Immutable workflow versions and snapshots
- [x] Deterministic editable follow-ups and exports
- [x] Reference-only documents, mailings and payments
- [x] Resettable synthetic scenario
- [ ] Production authentication, staff roles and tenant isolation
- [ ] Client-approved configurable stage rules and calendars
- [ ] Editing stage-specific template wording in the interface
- [x] Dedicated deficiency queue and keyboard-accessible application search
- [ ] Restore/import UI, automated backups and migration upgrades
- [ ] Full mobile, accessibility and adversarial security review


## Atelier UI / second movement (feature branch)

The Atelier visual system is served locally from `public/atelier.css` and requires no remote assets.
The **Portfolio** stage board derives case counts and outstanding work from active application records.
The **Evidence desk** lists unresolved deficiencies, separates unverified work from responses requiring verification, and routes staff into the correct application's review form. It never implies an authority's approval.
The **Today** exception alert is now calculated from the unresolved register instead of a hardcoded example.

Run `npm test` to execute domain and browser-script syntax checks. GitHub Actions also starts an isolated synthetic SQLite instance, exercises the API and confirms the stylesheet and both navigation routes can be served. These checks do **not** replace visual accessibility, keyboard, tablet or device-level QA. The demo remains local-only and is not suitable for real client records.

## Third movement: actionable case brief and browser acceptance

Every active case has exactly one **Next Accountable Action** brief selected deterministically from its own unresolved items. It prioritizes received-but-unverified evidence, overdue evidence, blocked work, unassigned tasks and remaining incomplete work. The brief shows the source owner and user-entered due date without inventing statutory deadlines, and routes directly to the source task or deficiency. A completed/withdrawn case produces no active recommendation. This is coordination assistance, not an eligibility or approval decision.

The **Portfolio** case tiles surface the same next action so coordinators can triage without opening every record. The case finder (⌘K / Ctrl+K) searches the source records by business, contact, reference, client and owner.

A dedicated `Browser acceptance` workflow uses pinned Playwright + Chromium against a disposable synthetic SQLite file and exercises the Today dashboard, portfolio board, evidence-review route, case finder, and handoff persistence. It uploads screenshot evidence and traces with limited retention. The UI uses no external fonts or images.

**Reproduce browser acceptance locally (not required for ordinary app use):**

```sh
npm install --no-save --no-audit --no-fund @playwright/test@1.56.1
npx playwright install chromium
# IMPORTANT: use a disposable database file, and do not use an existing demo database.
DB_PATH=/tmp/bridge-street-browser.sqlite npm start
# In another terminal:
npx playwright test --config playwright.config.mjs
```

The browser suite intentionally resets its configured database before each test. It must **never** be pointed at a database containing edits you want to preserve. CI runs in a fresh environment to avoid this risk.

**Unverified:** Visual browser tests, keyboard and viewport findings should be treated as pending until the `Browser acceptance` GitHub workflow completes successfully and artifacts are reviewed. Automated passing checks would not establish production security or accessibility conformance.

## Fourth movement: pilot-operable review, recovery and export

- The case-file **Next Accountable Action** is sourced from the application's own task/deficiency IDs, with a direct edit/review action; it never signifies statutory eligibility or approval.
- The **Chain of Custody** ledger presents structured task/application owner transfers, their notes and original UTC instants (displayed in the office's New York timezone). The original previous owner is never discarded.
- The **Portfolio** exports a CSV of active cases and unresolved work. It excludes withdrawn/completed records and prefixes spreadsheet-dangerous cell values before quoting them; no external spreadsheet integration is connected.
- **Stage advancement** lists the exact unresolved requirements before an override. The reason is persisted; deficiencies remain visible afterward.
- **Follow-up drafts** use each application's versioned stage-specific wording and current outstanding items. Staff can edit, choose a recipient, mark draft/accepted/rejected, copy locally or export text. Nothing is sent. Acceptance requires a valid recipient and nonempty draft.
- **Workflow library** can publish new immutable versions, including up to 30 task titles and stage-specific follow-up wording. An in-flight application retains its original snapshot. Explicit demo reset also restores the initial template version.
- **Stale saves** show a recoverable 409 conflict, preserve the form fields, offer an explicit copy action and reload the latest server record. The application never retries a conflicting mutation automatically.
- **Archived records** disable editing until reactivated. The API independently rejects writes to withdrawn/completed cases.
- **Date-only deadlines** are validated as real calendar dates, with timezone-provenance preserved on state-only edits. Case references are normalized for uniqueness without depending on business/contact names.
- Task cancellation requires an explicit explanatory note and audit history; it is not silently treated as completion. In the demo, cancelled items are excluded from the active checklist after staff has recorded that decision.
- A **Skip to main content** link and visible keyboard focus facilitate navigation. The active desk view is exposed through `aria-current`.

### Verification and remaining constraints

GitHub Actions runs a domain/HTTP integration suite and pinned Chromium acceptance on Ubuntu 24.04. The browser suite exercises case finding, evidence review, stage overrides, handoffs after reload, optimistic-concurrency recovery, portfolio CSV, stage-specific templates, inactive-case protection, and responsive layouts. It captures CI screenshots with short retention. Inspect the **latest commit's** GitHub Actions results before claiming the newest changes passed.

The app remains a **single demo organization with fixed demo actor identity**, no real authentication, no organization administration, no authorized legal workflow, no live emailing or payment processing, and no production security certification. Do not expose it on a public network or enter actual client data. A separate product-security and accessibility assessment is required before any real pilot using identifiable records.

### Adversarial checks

CI injects HTML-like text into a synthetic case name and verifies that the portfolio and application workspace render it as inert text, never as markup. API integration tests reject oversized notes and evidence references, invalid dates, and unreasoned cancellations. These tests strengthen the demonstration but are **not** a substitute for application security testing with real authentication and tenant isolation.

## Offline synthetic backup and recovery

The repository includes a checksum-verified **demo-only** archive tool, `backup.ts`. It is not exposed through HTTP. Stop the local demo server before restoring and ideally before exporting.

```sh
node backup.ts export ./backups/demo-archive.json
node backup.ts verify ./backups/demo-archive.json
# DANGER: Replaces the entire local demo dataset. Stop the server and archive current data first.
node backup.ts restore ./backups/demo-archive.json --replace
```

The archive preserves case revisions, task and deficiency records, drafts, reference records, historical template snapshots, handoffs, activity, and versioned workflow templates. The tool checks a SHA-256 checksum, validates record structure and referential integrity, refuses to overwrite an archive filename, and restores in a database transaction with rollback on failure.

**Limits:** SHA-256 is a corruption check, not encryption, access control, or defense against an attacker who recomputes the checksum. Archives may contain any information entered into the demo. Do not enter or upload real client data. This is not a production backup-and-disaster-recovery solution.
