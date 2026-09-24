# Tutor

Tutor your AI Agents to make them better.

Tutor is a plugin marketplace for coding agents — a collection of plugins and skills that teach agents workflows they don't have out of the box, from adversarial text humanization to dev-team orchestration to demo-video production.

## Quick install

```
/plugin marketplace add svallory/tutor
/plugin install <name>@tutor
```

## What's in it

| Plugin | What it does |
|--------|--------------|
| [Ghostwriter](/docs/ghostwriter) | Detects AI-sounding text and revises it until it reads as human. |
| [Team Lead](/docs/team-lead) | Runs a batch of tasks across developer agents, reviews their work, tracks progress. |
| [Demo Video](/docs/demo-video) | Narrated, subtitled MP4 demos of web-app features. |
| [OKF](/docs/okf) | Open Knowledge Format bundles: create, validate, enrich. |
| [Decompose](/docs/decompose) | Turns vague problems into ordered, testable hypotheses. |

## Where to go

- **[Docs](/docs)** — what each plugin does, how to install and configure it.
- **[Contribute](/contribute)** — how the build works, and how to add a plugin or skill.

## Skills without the plugins

Most of these also install as standalone skills through the [skills CLI](https://skills.sh), which works with Claude Code, Codex, Cursor, and others:

```
npx skills add svallory/tutor
```
