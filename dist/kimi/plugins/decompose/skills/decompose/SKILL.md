---
name: decompose
description: Break a hard problem into smaller knowns before trying to solve it. Use whenever you face a problem whose answer you do not immediately know, a bug or failure with no obvious cause, a vague or overloaded problem statement ("it's slow", "it's inaccurate", "it doesn't work"), a design or math question with no known recipe, or when you catch yourself about to search for an answer or guess instead of reasoning. Also use when the user says "I'm stuck", "hard problem", "break this down", "decompose", or "where do I even start".
---

# Decompose

The most underrated skill is learning how to decompose problems. An expert rarely solves a difficult problem all at once. They reduce it until the unknown becomes a collection of smaller knowns.

The same pattern shows up everywhere:

- Software: break a system into modules.
- Robotics: separate perception, estimation, planning and control.
- Mathematics: transform an unfamiliar problem into structures you already know how to manipulate.
- Engineering: isolate variables until cause and effect become visible.

Decomposition converts confusion into experiments. That is the whole point of this skill.

## When this triggers

Run this loop before anything else when:

- You do not immediately know the answer, or your first answer is a guess.
- The problem statement is vague ("the robot is inaccurate", "the API is flaky", "the model underperforms").
- A bug or failure has several plausible causes and you have not ruled any out.
- You feel the pull to search, ask, or try random fixes. Resist it. Reduce the problem first.

If the answer is obvious and you can verify it directly, skip the ceremony and just solve it. This skill is for hard problems, not every problem.

## The pipeline

```
problem -> constraints -> variables -> relationships -> subproblems -> solution
```

Six steps, in order:

| Step | Question | Output |
|------|----------|--------|
| 1. Define | What is the goal? | Desired state and observed state, both concrete. |
| 2. Identify | What can vary? | Every variable that could plausibly produce the gap. |
| 3. Analyze | How are they related? | Which variables drive which effects; dependencies and coupling. |
| 4. Decompose | What are the smaller problems? | Independent, testable subproblems, each with an owner variable. |
| 5. Test | One variable at a time | An experiment per hypothesis; hold everything else constant. |
| 6. Solve | Validate and iterate | Confirmed cause, applied fix, updated model of the system. |

The most important step is 2. Most failed problem solving comes from never identifying what is actually unknown.

## Step by step

### 1. Define: desired state vs observed state

Write both down explicitly. "The robot is inaccurate" is almost useless. "Commanded position is (x, y, z); measured position is off by 12 mm along x, consistently, under load" is a problem you can attack.

- Desired state: what should happen, in measurable terms.
- Observed state: what actually happens, in the same terms.
- The difference: the gap you are trying to close. Measure it, do not describe it.

### 2. Identify: enumerate the variables

List every factor that could produce that difference. Be exhaustive here; pruning comes later. For the robot example, one vague problem becomes seven testable hypotheses:

1. Is the commanded position wrong?
2. Is localization drifting?
3. Is the kinematic model inaccurate?
4. Is there actuator backlash?
5. Is the controller poorly tuned?
6. Is latency creating phase lag?
7. Is the mechanical structure flexing under load?

For a software problem the same move produces: wrong input, wrong config, wrong environment, stale cache, race condition, dependency version, resource limit, and so on.

Ask of each variable: is it capable of producing the observed difference? If not, drop it. If it could only explain part of the gap, note that; the answer may be a combination.

### 3. Analyze: map the relationships

Figure out how the variables interact. Which are upstream of which? Which are coupled so that changing one moves another? Which are independent and can be tested in isolation?

This is where domain primitives pay off. The more building blocks you have (control theory, distributed systems, linear algebra, whatever the domain), the sharper the map. If you lack a primitive, name the gap; that is itself a subproblem.

### 4. Decompose: split into subproblems

Turn the variable list into independent subproblems, ideally forming a tree: the root is the original problem, each child is a hypothesis, each leaf is something you can directly check. Order them by:

- Likelihood, given the evidence so far.
- Cost to test.
- How much of the tree a result would prune.

Cheap tests that eliminate whole branches go first.

### 5. Test: one variable at a time

For each subproblem:

- Hold every other variable constant where possible.
- Change one thing.
- Observe. Record the actual measurement, not an impression.
- Update your model of the system based on the result.

If a test result surprises you, that is signal. Go back to step 2 or 3; your variable list or relationship map was incomplete.

### 6. Solve: validate and iterate

Once a hypothesis is confirmed, apply the fix and re-measure the gap from step 1. If the gap closed, done. If it only shrank, the remaining gap is a new, smaller problem: run the loop again on it.

This is the scientific method compressed into a practical problem solving loop.

## Output format

When applying this skill, make the decomposition visible before proposing a solution. A compact form:

```
Goal:      <desired state>
Observed:  <observed state>
Gap:       <measured difference>

Hypotheses (ordered by likelihood x cheapness to test):
  1. <variable>  -> test: <experiment>  -> expected if true: <observation>
  2. ...

Next test: #1
```

Then execute tests in order, reporting each result and what it rules in or out, until the gap is explained.

## Anti-patterns

- Searching for an answer before defining the problem. Reduce first.
- Changing several variables at once. You learn nothing from the result.
- Treating a symptom as the problem statement ("it's slow").
- Stopping at the first plausible cause without ruling out the others.
- Confusing a description with a measurement.

## Why this matters

Experts do not encounter easier problems. They have a larger library of ways to break difficult problems into familiar ones. Every technical subject you learn (mathematics, physics, programming, engineering) adds primitives to that library, and better primitives produce better decompositions. You are accumulating primitives for thought.

Source: adapted from a post by Mustafa (@oprydai) on X, "From Complexity to Clarity: break it down, solve it forward."
