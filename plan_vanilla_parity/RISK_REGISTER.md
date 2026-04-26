# Risk Register

| id | risk | impact | mitigation |
| --- | --- | --- | --- |
| R-VP-001 | Missing `doom.ts`. | Blocks all final acceptance. | Early launch lane creates real Bun entrypoint and smoke test. |
| R-VP-002 | Existing final gates pass from manifests. | False completion. | Validator and acceptance steps reject manifest-only final proof. |
| R-VP-003 | Oracle fixtures contain deferred live capture statuses. | Missing authority for behavior. | Reference/oracle lane replaces them with live captures. |
| R-VP-004 | Audio device output may differ by host. | False mismatches or hidden drift. | Compare event logs plus deterministic mixer windows before device presentation. |
| R-VP-005 | DOS binary instrumentation may be hard on modern Windows. | Reference proof gap. | Use local `DOOM.EXE` as practical secondary only when agreement or infeasibility is recorded. |
| R-VP-006 | Registered/Ultimate IWADs may be absent. | Scope cannot be fully verified locally. | Shareware first; later gates are conditional on supplied IWADs. |
| R-VP-007 | Parallel work may conflict on shared interfaces. | Merge instability. | Lane write locks and G0-G6 checkpoints control convergence. |
| R-VP-008 | Proprietary assets could be accidentally committed. | Legal and repository risk. | Keep `doom/` and `iwad/` read-only/ignored and validate write locks. |
