<session_key>

Resolve only the final integration findings for `<spec_id>` revision `<revision>` from @<spec_path>.

<final_review_findings>
<optional_skill_mentions>
<optional_request_overrides>

Use completed Slices as boundaries and change only what the listed integration findings require. Do not reopen passed local design or add unrelated cleanup.

Before editing, record the VCS HEAD and pre-existing changed paths when available. Preserve that work and distinguish your changes, including overlap or uncertain attribution.

Do not change Spec/Slice lifecycle or create another task or subagent. When complete, use `send_message_to_thread` to report to the originating task. Lead with resolved findings, then list task-attributable paths, baseline/overlap, affected verification, and remaining issues briefly.
