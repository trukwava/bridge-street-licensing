# Product brief, data and acceptance contract

Primary user: a licensing coordinator at fictional Bridge Street Licensing. Promise: see the next requirement, accountable owner, and next action for each application. Smallest complete flow: create → template tasks → update/handoff → persist → export.

P0 is application coordination, Today, deficiencies, stage review, handoffs, drafts and exports. Parking lot: statutory databases, official portal automation, billing, signatures, autonomous sending and AI wording refinement.

## Persistent schema v1

`records(id TEXT PRIMARY KEY, org TEXT NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL)` stores one application aggregate; `templates(version INTEGER PRIMARY KEY, body TEXT NOT NULL)` stores immutable workflow versions. Initialization uses CREATE TABLE IF NOT EXISTS. There is no destructive automatic migration.

Application includes identity/reference, client, business, contact, type, jurisdiction label, owner, stage, priority, lifecycle status, templateVersion, templateSnapshot and revision. Task has ID, title, one owner or null, stage, state, dependencies (TaskDependency IDs), date-only due, provenance and revision. Deficiency has description, evidence, requested and optional due dates, response, verification state and resolution. DocumentReference, MailingRecord and PaymentReference retain labels/reference values without interpreting them. CorrespondenceDraft stores body, recipient, review state, source item texts, template identifier and UTC creation instant. Handoff retains prior/new owner, note and UTC timestamp. AuditEvent stores actor, action and UTC timestamp. WorkflowTemplateVersion snapshots Stage order, task titles and follow-up identifiers.

Aggregate saves update revision atomically with `WHERE revision = expected`; a conflict returns 409. Record access always includes org='demo'. This is not a substitute for authenticated production tenant authorization.

## State rules

Open → in progress / blocked / awaiting response / completed / cancelled.
In progress → open / blocked / awaiting response / completed / cancelled.
Blocked → open / in progress / awaiting response / cancelled.
Awaiting response → open / in progress / blocked / completed / cancelled.
Completed or cancelled → open.
A same-state save is allowed. Completion checks dependency completion. Stage advance checks all unresolved tasks and deficiencies conservatively; an explicit demo supervisor reason overrides advancement, never resolves prerequisites. Application completion requires no outstanding tasks/deficiencies. Withdrawn/completed applications are omitted from Today.

Due dates are date-only strings, never statutory inferences. Audit timestamps are ISO UTC instants; UI display timezone is America/New_York. No extraction or normalization of external source values occurs.

## Acceptance scenarios defined for the critical slice

1. 15 seeded applications include 40 tasks, 10 deficiencies, 2 unassigned and 3 overdue tasks, a duplicate-looking name pair, repeated contact surname across businesses and a withdrawn record.
2. BS-001 intake completion does not resolve its address deficiency. Unreasoned advancement fails; reasoned override persists the open deficiency and reason.
3. BS-001 draft requests its address proof and excludes BS-002's declaration.
4. Alex-to-Morgan task handoff appears after reread and retains Alex in activity.
5. A stale revision returns 409 and cannot overwrite a newer owner.
6. New workflow versions do not mutate an existing checklist/snapshot.
7. Duplicate references and unknown application IDs fail validation.

Limitations: reference rows and deficiency dates need stronger production schema constraints; role selection is fixed; audit history is application-managed and not tamper-proof. These are pilot gates, not certified capabilities.
