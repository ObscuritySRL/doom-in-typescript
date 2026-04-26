param(
    [string]$PromptPath = "D:\Projects\doom-in-typescript\plan_vanilla_parity\PROMPT.md",
    [string]$PlanDirectory = "D:\Projects\doom-in-typescript\plan_vanilla_parity",
    [string]$WorkingDirectory = "D:\Projects\doom-in-typescript",
    [string]$LogDirectory = "D:\Projects\doom-in-typescript\plan_vanilla_parity\loop_logs",
    [string]$LaneLockDirectory = "D:\Projects\doom-in-typescript\plan_vanilla_parity\lane_locks",
    [string]$Lane = "",
    [ValidateSet("low", "medium", "high", "max")]
    [string]$Effort = "max",
    [string]$Model = "claude-opus-4-7",
    [string]$ClaudeCommand = "claude",
    [int]$LockLeaseMinutes = 120,
    [int]$MaxIterations = 2147483647,
    [int]$SleepSeconds = 0
)

$scriptPath = Join-Path $PSScriptRoot "RALPH_LOOP_CLAUDE_CODE_NO_AUDIT.ps1"

& $scriptPath `
    -PromptPath $PromptPath `
    -PlanDirectory $PlanDirectory `
    -WorkingDirectory $WorkingDirectory `
    -LogDirectory $LogDirectory `
    -LaneLockDirectory $LaneLockDirectory `
    -Lane $Lane `
    -Effort $Effort `
    -Model $Model `
    -ClaudeCommand $ClaudeCommand `
    -LockLeaseMinutes $LockLeaseMinutes `
    -MaxIterations $MaxIterations `
    -SleepSeconds $SleepSeconds

exit $LASTEXITCODE
