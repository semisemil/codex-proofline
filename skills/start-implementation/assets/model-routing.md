# Model Routing

Use this policy for new implementation sessions and independent parallel implementers. Preparation and independent Reviewers follow their own settings contracts. Explicit user model, reasoning, and usage limits take precedence; select only unspecified settings. Check support and permission to apply both settings in the execution environment. Report unsupported selections or conflicting limits instead of silently substituting them.

Choose model capability and reasoning effort separately. Default to Astra `medium`; select Luna or Sol when the work supplies positive evidence that they are sufficient. The rows are candidates, not a promotion ladder or an empirical ranking of model/effort combinations.

| Model | Reasoning | Selection criterion |
| --- | --- | --- |
| `gpt-5.6-luna` | `high` | The change method is effectively settled and the result can be verified by clear tests or comparison; use `xhigh` only when the same settled method needs complex condition tracking |
| `gpt-5.6-sol` | `medium` / `high` | Requirements, the existing implementation pattern, and the impact boundary are understood, but implementation logic remains to be worked out; use `high` for complex branches, exceptions, or state transitions within that known approach |
| `gpt-6-astra` — Astra Light | `low` | Implementation or design judgment remains, but the supplied evidence supports a short decision without deep reasoning; visual work is not required |
| `gpt-6-astra` | `medium` | Default when cause, implementation direction, and impact need joint judgment, or evidence that Luna/Sol suffice is lacking |
| `gpt-6-astra` | `high` | Deep tracing of interacting hypotheses, states, or execution orders, or consequential judgment that is difficult to verify |

Judge the actual changed behavior. An existing pattern alone does not establish Luna suitability; the concrete change method must already be settled. File count, repository breadth, security-related terminology, an ordinary test failure, or failure impact alone does not select the model or effort. Difficult reasoning can justify `high` even when failure impact is small. Do not infer that Astra `low` is cheaper than Sol at higher effort. Terra and Spark are not initial routing candidates.

Record the task characteristic and reason for the selected model and effort in one sentence. Set both fields at dispatch when permitted. Continue that assignment while the evidence still supports it; judge a cheaper choice for the next independent task rather than switching down during execution. Keep context within 256K or the smaller actual supported limit, without context-extension settings. Use focused source context rather than copying the full conversation. Do not introduce benchmark-based success probabilities, fixed allocation ratios, or price tables.

For parallel implementers, reassess when Luna/Sol cannot resolve the same issue after repair and re-verification, or new evidence shows broader judgment is needed. Select a fitting Astra effort directly; prior failure is not required and no intermediate model is mandatory. End the old execution and its writes before replacing it. Respect explicit selections and usage limits during reassignment. Address environment, permission, and missing-requirement problems by their cause. If Astra repeats a failure without new evidence or progress, report the blocker and needed information or decision. This policy does not automatically recreate the main session or transfer an in-progress run.
