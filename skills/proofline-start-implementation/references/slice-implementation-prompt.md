<session_key>

Implement only @<slice_path> for revision `<revision>` from @<spec_path>.

<optional_skill_mentions>
<optional_pre_review_findings>
<optional_request_overrides>

Use the parent Spec as the contract and the Slice as the execution boundary. Preserve unassigned requirements and existing behavior; do not implement another Slice.

Before editing, record the VCS HEAD and pre-existing changed paths when available. Preserve that work and distinguish your changes, including overlap or uncertain attribution.

Do not change Spec/Slice lifecycle or create another task or subagent. When complete, use `send_message_to_thread` to report to the originating task. Lead with the delivered Slice outcome, then list covered REQs, task-attributable paths, baseline/overlap, directly relevant verification, and remaining issues briefly.
