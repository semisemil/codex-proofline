# Review Control

Read this only after `changes_required`, `no_verdict`, malformed output, or reviewer/tool execution failure.

## Eligible findings

Forward a finding only when the existing report identifies the allowed category, exact obligation or required-check source, affected REQ/Slice/boundary, current evidence and reachable path, material impact, required fix, and affected verification. A scope finding must also identify the current out-of-scope change; the coordinator's recorded baseline must support task attribution. A check's existence alone does not make it required. Stop at `no_verdict` when attribution is unavailable or applying a source requires a material interpretation choice.

If fields are missing, send `review-report-repair.md` to the same reviewer once. Supply only the missing-field list. The reviewer may support or withdraw existing findings but may add none. This repair does not consume a review attempt. Re-evaluate the corrected report once.

## Progress and limits

- Send only eligible findings to the responsible implementation task.
- For `no_verdict`, request only implementation evidence that the review report explicitly identifies as missing. Otherwise report the unavailable or disputed boundary.
- A reviewer/tool execution failure permits one fresh replacement reviewer. It does not consume a verdict-bearing attempt.
- Identify a finding by category, cited source, affected requirement/boundary, and reachable path. Stop on the same finding, a return to any earlier finding in the scope, or the same evidence request.
- Record the reviewed candidate state: staged diff for a Git direct/Slice review, committed Slice state plus staged integration for Git final review, or current authorized changes for non-Git. A new review requires a material fix or new requested evidence; unchanged state ends the loop.
- Stop when the scope's third verdict-bearing attempt does not pass. Neither `changes_required` nor `no_verdict` changes Spec status. Set `blocked` only for an external prerequisite.
