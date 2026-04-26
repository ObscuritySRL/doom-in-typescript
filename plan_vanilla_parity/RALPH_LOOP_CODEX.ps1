param(
    [string]$PromptPath = "D:\Projects\doom-in-typescript\plan_vanilla_parity\PROMPT.md",
    [string]$PlanDirectory = "D:\Projects\doom-in-typescript\plan_vanilla_parity",
    [string]$WorkingDirectory = "D:\Projects\doom-in-typescript",
    [string]$LogDirectory = "D:\Projects\doom-in-typescript\plan_vanilla_parity\loop_logs",
    [string]$LaneLockDirectory = "D:\Projects\doom-in-typescript\plan_vanilla_parity\lane_locks",
    [string]$Lane = "",
    [ValidateSet("minimal", "low", "medium", "high", "xhigh", "max")]
    [string]$Effort = "xhigh",
    [string]$Model = "gpt-5.5",
    [string]$CodexCommand = "codex",
    [int]$LockLeaseMinutes = 120,
    [int]$MaxIterations = 2147483647,
    [int]$ProgressStatusSeconds = 180,
    [int]$SleepSeconds = 0
)

$scriptPath = Join-Path $PSScriptRoot "RALPH_LOOP_CODEX_NO_AUDIT.ps1"

& $scriptPath `
    -PromptPath $PromptPath `
    -PlanDirectory $PlanDirectory `
    -WorkingDirectory $WorkingDirectory `
    -LogDirectory $LogDirectory `
    -LaneLockDirectory $LaneLockDirectory `
    -Lane $Lane `
    -Effort $Effort `
    -Model $Model `
    -CodexCommand $CodexCommand `
    -LockLeaseMinutes $LockLeaseMinutes `
    -MaxIterations $MaxIterations `
    -ProgressStatusSeconds $ProgressStatusSeconds `
    -SleepSeconds $SleepSeconds

exit $LASTEXITCODE
