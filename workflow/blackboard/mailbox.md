# Mailbox — agent-to-agent messages

> No role calls another directly. Messages are routed here: a role writes to the queue, the
> orchestrator (router) delivers, and the recipient drains its inbox and marks it done.
> (Adopted from the Munder Difflin hive mailbox.)

## Queue
`[ ] from: <role>  to: <role>  re: <DT-key>  ·  <one-line message>`

- [ ] from: architect   to: developer   re: DT-000   ·  example: "contract for <feature> is ready"

## Delivered
- [x] from: pm   to: architect,designer   re: DT-000   ·  example: "spec approved, start design"
