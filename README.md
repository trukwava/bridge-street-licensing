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

Four domain tests passed. Live HTTP checks passed for seed counts (15 applications, 40 tasks, 10 deficiencies, 3 overdue tasks, 2 unassigned tasks), correct-record drafting, stage blocker/override, handoff reload persistence, stale-edit rejection (409), immutable template snapshots, unknown-record rejection, and create/reference uniqueness validation. Desktop browser verification confirmed Today, application workspace, and generation of the correct address request. Mobile CSS is implemented but device-level testing remains pending.

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
- [ ] Dedicated deficiency queue and full application search
- [ ] Restore/import UI, automated backups and migration upgrades
- [ ] Full mobile, accessibility and adversarial security review

## Source note

Original implementation inspired by the user-supplied [Pursuit Lookbook NY Business Licensing reference](https://lookbook.pursuit.org/projects/ny-business-licensing). The page could not be retrieved during this build. No code, branding, customer data, proprietary documents, performance figures or adoption claims were reused. See `docs/pilot.md` for the proposed pilot.
