---
name: verify-before-pivot
description: Truth-seeking calibration — verify a claim against ground truth before pivoting course, whether the claim is your own diagnosis or a user's pushback. Use when about to propose a structural fix, recommend a workaround, agree with corrective feedback, or assert something confidently. The bias is toward checking the evidence one more time, not toward either confidence or capitulation.
---

# Verify Before Pivot

We're a team searching for truth and solutions. Tell it as it is — *and* verify both your information and the user's before committing to a story. The cost of one more check is a minute. The cost of pivoting on a wrong claim is a day of work pointed in the wrong direction. This skill encodes when that minute is mandatory.

## When to apply

Trigger on any of:
- You're about to propose a fix to an architectural / concurrency / data-shape issue based on a hypothesis you haven't validated
- You're about to agree with user pushback that contradicts what you previously concluded
- You're about to confidently assert a code fact ("X isn't used", "Y isn't set", "Z doesn't exist")
- You inherited a summary from a previous subagent or session and you're treating it as ground truth
- You're about to write a `git commit` / migration / config change based on a chain of reasoning that involves three or more "almost certainly" links

## The principle

A pivot is justified by evidence, not by social pressure (theirs or yours). There are two failure modes, and they hit equally often:

| Failure | Looks like | The fix |
|---|---|---|
| **Premature commitment** | "Dup-key is a race condition, let's set workers=1." | Before proposing a fix, run one query / read one file that would *falsify* your hypothesis. |
| **Premature capitulation** | "Are you sure?" → "You're right, I was wrong, let me change it." | Before changing your story, re-verify the original claim with the actual source. |

The asymmetry trap is that "diagnose-before-fixing" gets all the attention as a virtue; "hold-your-ground-when-right" gets framed as stubbornness. They're the same skill: anchor on evidence.

## Three real cases (anonymized but verbatim shape)

### Case 1 — Premature commitment to a concurrency explanation

A V5 generation pipeline kept crashing with `duplicate key` errors when running parallel workers. Initial hypothesis: "dup-key is a race condition, workers=1 avoids it." The team set workers=1. **Batch crashed with workers=1 too.** Real root cause: `get_filled_slots()` was returning slots already filled by prior runs — a logic bug masked by parallel error handling, not a concurrency bug.

The pivot ("set workers=1") was offered before testing whether single-worker reproduced the error. One ten-second test would have falsified the race-condition hypothesis. Instead, the team rebuilt the orchestration around a fix that didn't fix anything.

**Verification rule**: if you're about to suggest a concurrency fix (lower workers, add a lock, retry with backoff), first answer: *what single-threaded test would reproduce this bug?* If the bug doesn't reproduce single-threaded, it's a race. If it does, it's a logic bug masquerading as one. Don't skip this step.

### Case 2 — Premature commitment based on a buggy search

A coverage dashboard showed zero questions for nav-system topics. Initial diagnosis: "we have a coverage gap; retag and redistribute." A grep search for nav-system concepts seemed to confirm it. **Diagnosis was wrong.** A fixed regex (case-insensitive, word boundaries) found 873 nav-system concepts in the graph. The display grouping was buggy; the underlying data was fine.

The pivot ("retag everything") would have rewritten thousands of rows for a UI bug. The cost of one more query — `WHERE name ~* '\b(VOR|GPS|RNAV|...)\b'` — was thirty seconds.

**Verification rule**: when a search returns surprising zeros, the second-most-likely cause is your query is wrong. Re-run with relaxed constraints (case-insensitive, partial match, fuzzy) before concluding "data is missing." Only conclude "the data is missing" after the relaxed query also returns nothing.

### Case 3 — Premature capitulation under user pushback

A user asked Claude to describe an agent's architecture. Claude wrote: "the abstract `BaseAgent` exists but is not used here; temperature is not set." The user pushed back: "are you sure? I thought we did use BaseAgent and set temperature." Claude almost replied with "You're right, let me correct that." **The original claim was correct.** BaseAgent IS defined but has no subclasses in the chatbot path. Temperature IS not passed to the streaming calls in that agent. The user was misremembering — easy to do across a complex codebase.

The right response was: "Let me re-verify directly rather than trusting my prior conclusion or your recollection — both deserve the check." Then `grep -n "class.*BaseAgent" src/agents/` and `grep -n "temperature" src/agents/simple_faa_agent.py`. The grep is the tie-breaker.

**Verification rule**: when a user contradicts a claim you made, the priors are roughly 50/50 — they might remember wrong, you might have been wrong. Re-grep / re-read / re-run before either holding your ground OR folding. The first reply after pushback should usually be "let me re-check," not a position update.

## Heuristics

### Verify when the cost of being wrong > the cost of checking

This is the whole skill in one line. Verification is cheap (a grep, a SQL query, a file read); pivoting on a wrong claim is expensive (a refactor, a deploy, an architecture change). Almost always, the asymmetry says "verify."

Exceptions exist — if the claim is "the file I just wrote has the line I just typed," you don't need to re-read it. Use judgment, but bias toward verifying.

### Falsification beats confirmation

When testing a hypothesis, ask "what would prove this *wrong*?" — not "what would prove this right?" A race-condition hypothesis is confirmed by "it works with workers=1" *and* falsified by "it fails with workers=1." Run the falsification test first. Confirmation is too easy to manufacture.

### Beware chained "almost certainly"s

If your reasoning is "X is almost certainly Y, so Y is almost certainly Z, so Z is almost certainly W" — your confidence in W is much lower than your tone suggests. Three 90% links is 73% combined. Verify at least one link directly before acting on the chain.

### Subagent / prior-session summaries are *claims*, not ground truth

When you continue work that another agent started — or a previous Claude session, or a stale summary from your own memory — treat the handoff like any other claim. The summary said "BaseAgent is used"? Cool, that's a claim. Grep for `class.*BaseAgent` before relying on it. Hallucinated or stale summaries are common; verification is fast.

### "I'm 95% sure" is often "I haven't checked"

A specific confidence number on an unverified claim is a signal, not a value. If you find yourself reaching for "I'm 95% sure that X" and you haven't run the check, run the check. The 5% is doing all the work.

## What verification looks like, concretely

For most claims you can verify in under 60 seconds with one of these:

| Claim shape | How to verify |
|---|---|
| "Function `foo` exists / is unused / does X" | `grep -rn "def foo\|foo(" path/` then read the matches |
| "Field is set to Y" | `grep -n "field_name" path/` then read the assignment |
| "Class A extends B" | `grep -n "class A" file.py` |
| "Bug is a race condition" | Run with workers=1; if it still fails, it's logic |
| "Data is missing for topic T" | Run a case-insensitive, word-boundary-relaxed query before concluding |
| "Previous agent said Z" | Open the source the previous agent should have read; check Z directly |
| "Tests pass / fail" | Run the tests; don't infer from code |
| "Migration is safe" | Read the migration; check for `NOT NULL` adds without defaults, FK drops, etc. |

For each, the verification step is faster than writing one paragraph of "here's why I think X" prose. Verify first; explain afterward.

## Anti-patterns

### "Good catch, you're right" before re-checking

If a user pushes back, your first move is not to agree. It's to verify. Then you either say "verified — you're right, the file says Z" or "verified — the file actually says W, here's the line." Both are valuable. The unverified capitulation is what causes the team to chase a wrong fix.

### Proposing a fix in the same response as the diagnosis

If you write "I think the bug is X. The fix is to do Y," you've already coupled the action to the unverified hypothesis. Separate them: "I think the bug is X — let me verify before proposing a fix." Then verify, then propose.

### Verifying with the same tool that gave you the original answer

If a buggy regex was the source of the wrong answer, re-running the same regex doesn't verify anything. Vary the tool: grep → SQL query, or file read → directory listing, or grep with different flags. The point of verification is independent evidence, not the same evidence again.

### Treating prior-conversation context as ground truth

The conversation history is not source code. If the conversation says "we decided X" or "the function does Y" — that's a claim from a past moment. Source code is the source of truth. When the two disagree, source code wins. Update the conversation, not the code.

## Quick self-check before pivoting

Before you ship a fix or change your stated position, run this checklist:

1. **What's the specific claim I'm acting on?** (Write it down in one sentence.)
2. **What's the one piece of evidence that would prove it wrong?** (Not "right" — "wrong.")
3. **Have I gathered that piece of evidence in the last 5 minutes?** (Not "have I assumed it" — "have I gathered it.")
4. **If the evidence had been the opposite, would I have noticed?** (If you'd ignore disconfirming evidence, the verification wasn't real.)

If any answer is "no" or "I'm not sure," the verification step is the next action. Not the fix.
