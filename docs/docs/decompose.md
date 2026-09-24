# Decompose

Structured problem decomposition for hard problems: reduce an unknown into a collection of smaller knowns, turn confusion into testable hypotheses, and solve forward one variable at a time.

Experts don't encounter easier problems — they have a larger library of ways to break difficult problems into familiar ones. Decompose gives your agent that library as an explicit six-step loop, so it reduces the problem before reaching for an answer.

## Install

```
/plugin marketplace add svallory/tutor
/plugin install decompose@tutor
```

Or as a standalone skill via the [skills CLI](https://skills.sh):

```
npx skills add svallory/tutor --skill decompose
```

No external tools or dependencies are required.

## When it triggers

The skill activates when the agent faces a problem whose answer isn't immediately known:

- You don't immediately know the answer, or the first answer is a guess.
- The problem statement is vague — "it's slow", "it's inaccurate", "it doesn't work".
- A bug or failure has several plausible causes and none have been ruled out.
- The agent feels the pull to search, ask, or try random fixes.

Explicit trigger phrases: **"I'm stuck"**, **"hard problem"**, **"break this down"**, **"decompose"**, **"where do I even start"**.

If the answer is obvious and directly verifiable, the skill stays out of the way — it's for hard problems, not every problem.

## The pipeline

```
problem -> constraints -> variables -> relationships -> subproblems -> solution
```

| Step | Question | Output |
|------|----------|--------|
| 1. Define | What is the goal? | Desired state and observed state, both concrete. |
| 2. Identify | What can vary? | Every variable that could plausibly produce the gap. |
| 3. Analyze | How are they related? | Which variables drive which effects; dependencies and coupling. |
| 4. Decompose | What are the smaller problems? | Independent, testable subproblems, each with an owner variable. |
| 5. Test | One variable at a time | An experiment per hypothesis; hold everything else constant. |
| 6. Solve | Validate and iterate | Confirmed cause, applied fix, updated model of the system. |

Step 2 matters most. Most failed problem solving comes from never identifying what is actually unknown.

## How each step works

### 1. Define — desired state vs observed state

Both get written down explicitly, in measurable terms. "The robot is inaccurate" is almost useless. "Commanded position is (x, y, z); measured position is off by 12 mm along x, consistently, under load" is a problem you can attack.

The difference between the two is the gap. It gets measured, not described.

### 2. Identify — enumerate the variables

Every factor that could produce the gap gets listed, exhaustively; pruning comes later. One vague robotics problem becomes seven testable hypotheses:

1. Is the commanded position wrong?
2. Is localization drifting?
3. Is the kinematic model inaccurate?
4. Is there actuator backlash?
5. Is the controller poorly tuned?
6. Is latency creating phase lag?
7. Is the mechanical structure flexing under load?

The same move on a software problem produces: wrong input, wrong config, wrong environment, stale cache, race condition, dependency version, resource limit.

Each variable is then tested against one question: is it capable of producing the observed difference? If not, it's dropped. If it could only explain part of the gap, that's noted — the answer may be a combination.

### 3. Analyze — map the relationships

Which variables are upstream of which, which are coupled so that changing one moves another, and which are independent enough to test in isolation.

This is where domain primitives pay off. If a needed primitive is missing, the gap gets named — that's itself a subproblem.

### 4. Decompose — split into subproblems

The variable list becomes a tree: the root is the original problem, each child a hypothesis, each leaf something directly checkable. Ordering is by likelihood given the evidence, cost to test, and how much of the tree a result would prune. **Cheap tests that eliminate whole branches go first.**

### 5. Test — one variable at a time

For each subproblem: hold every other variable constant, change one thing, observe, and record the actual measurement rather than an impression.

A surprising result is signal — it sends the loop back to step 2 or 3, because the variable list or relationship map was incomplete.

### 6. Solve — validate and iterate

Once a hypothesis is confirmed, the fix is applied and the gap from step 1 re-measured. If the gap closed, done. If it only shrank, the remaining gap is a new, smaller problem and the loop runs again on it.

## Output format

The skill makes the decomposition visible *before* proposing a solution:

```
Goal:      <desired state>
Observed:  <observed state>
Gap:       <measured difference>

Hypotheses (ordered by likelihood x cheapness to test):
  1. <variable>  -> test: <experiment>  -> expected if true: <observation>
  2. ...

Next test: #1
```

Tests then execute in order, each result reported with what it rules in or out, until the gap is explained.

## Anti-patterns it prevents

- Searching for an answer before defining the problem.
- Changing several variables at once — you learn nothing from the result.
- Treating a symptom as the problem statement ("it's slow").
- Stopping at the first plausible cause without ruling out the others.
- Confusing a description with a measurement.

## Credits

Adapted from a post by Mustafa ([@oprydai](https://x.com/oprydai)) on X, "From Complexity to Clarity: break it down, solve it forward."

## See also

- [Team Lead](/docs/team-lead) — decomposes a batch of tasks across developer agents.
- [Plugin overview](/docs/) — the rest of the marketplace.
