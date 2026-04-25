# Audit Log

Append-only record of completed-step audits. Each audited step gets one entry per auditing agent.

The Ralph-loop audit prompt and audit-only launchers use this file to decide which completed steps remain eligible for each agent. An entry by `Codex` makes that step ineligible for future Codex audits, but it does not make the step ineligible for `Claude Code`. An entry by `Claude Code` works the same way in the opposite direction.

Required entry shape:

```md
## <UTC timestamp> - <step_id> <step_title> - <agent>

- status: completed|blocked
- agent: Codex|Claude Code
- model: <model>
- effort: <effort>
- step_id: <step_id>
- step_title: <step_title>
- prior_audits: <agent/status/finding summary or none>
- correctness_findings: <summary or none>
- performance_findings: <summary or none>
- improvement_findings: <summary or none>
- corrective_action: <summary or none>
- files_changed: <semicolon-separated paths or none>
- tests_run: <semicolon-separated commands or none>
- follow_up: <summary or none>
```
