# Decompose plugin

Structured problem decomposition for hard problems. Break confusion into testable hypotheses.

## What it does

The `decompose` skill turns problem-solving into a systematic 6-step loop:

1. **Define** — Write desired state vs observed state explicitly
2. **Identify** — Enumerate variables that could produce the gap
3. **Analyze** — Map how variables relate and interact
4. **Decompose** — Split into independent, testable subproblems
5. **Test** — Experiment on one variable at a time
6. **Solve** — Validate and iterate on confirmed causes

Reduces an unknown into a collection of smaller knowns. Triggers on "hard problem", "decompose", "I'm stuck", or vague problem statements ("it's slow", "it doesn't work").

## Install

```
/plugin install decompose@tutor
```

Or via the [skills CLI](https://skills.sh):

```
npx skills add svallory/tutor --skill decompose
```
