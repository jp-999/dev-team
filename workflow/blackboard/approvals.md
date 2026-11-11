# Approvals — human-in-the-loop gate

> Some actions must not run autonomously. The orchestrator **pauses** the affected task and
> files it here until a human decides. (Adopted from Relevance AI / Keystroke / Munder gates.)

**Always require approval for:** spend above budget, scope changes, destructive ops
(data/schema/prod), external side effects (emails, deploys, payments), new dependencies.

## Pending
- [ ] DT-000 · <action> · requested by <role> · reason: <why> · risk: low|med|high

## Resolved
- [x] DT-000 · approved|rejected by <human> · <note>
