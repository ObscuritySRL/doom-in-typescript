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

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding

$script:SelectedLane = ""
$script:SelectedLockId = ""
$script:SelectedStepId = ""
$script:SelectedStepTitle = ""

function Add-ExecutionMetadata {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PromptText,
        [Parameter(Mandatory = $true)]
        [string]$Agent,
        [Parameter(Mandatory = $true)]
        [string]$Model,
        [Parameter(Mandatory = $true)]
        [string]$Effort,
        [Parameter(Mandatory = $true)]
        [string]$LaneName,
        [Parameter(Mandatory = $true)]
        [string]$LockId,
        [Parameter(Mandatory = $true)]
        [string]$InitialStepId,
        [Parameter(Mandatory = $true)]
        [string]$InitialStepTitle
    )

    return @"
Execution metadata for this Ralph-loop invocation:
- agent: $Agent
- model: $Model
- effort: $Effort

Lane lock metadata for this Ralph-loop invocation:
- lane: $LaneName
- lock_id: $LockId
- initial_eligible_step_id: $InitialStepId
- initial_eligible_step_title: $InitialStepTitle

Work only in lane `$LaneName`. Select the first unchecked eligible step in that lane from `plan_vanilla_parity/MASTER_CHECKLIST.md`. Do not switch lanes. If no eligible step remains in this lane, stop with `RLP_STATUS: NO_ELIGIBLE_STEP`.

Record these exact values in any `plan_vanilla_parity/HANDOFF_LOG.md` completion entry and in the final `RLP_AGENT`, `RLP_MODEL`, `RLP_EFFORT`, and `RLP_LANE` fields.

$PromptText
"@
}

function ConvertTo-CanonicalRlpStatus {
    param(
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return ""
    }

    $normalizedValue = $Value.Trim()
    $normalizedValue = $normalizedValue -replace '^[`''"*]+|[`''"*]+$', ""
    $normalizedValue = $normalizedValue -replace '[.!?,;:]+$', ""
    $normalizedValue = $normalizedValue -replace '[\s-]+', "_"
    $normalizedValue = $normalizedValue.ToUpperInvariant()

    switch ($normalizedValue) {
        "BLOCKED" { return "BLOCKED" }
        "BLOCKER" { return "BLOCKED" }
        "COMPLETE" { return "COMPLETED" }
        "COMPLETED" { return "COMPLETED" }
        "DONE" { return "COMPLETED" }
        "LIMIT" { return "LIMIT_REACHED" }
        "LIMIT_REACHED" { return "LIMIT_REACHED" }
        "LIMITREACHED" { return "LIMIT_REACHED" }
        "NO_ELIGIBLE_STEP" { return "NO_ELIGIBLE_STEP" }
        "NO_ELIGIBLE_STEPS" { return "NO_ELIGIBLE_STEP" }
        "OK" { return "COMPLETED" }
        "RATE_LIMIT" { return "LIMIT_REACHED" }
        "RATE_LIMITED" { return "LIMIT_REACHED" }
        "SUCCESS" { return "COMPLETED" }
        "USAGE_LIMIT" { return "LIMIT_REACHED" }
        default { return "" }
    }
}

function ConvertTo-CodexReasoningEffort {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    if ($Value -eq "max") {
        return "xhigh"
    }

    return $Value
}

function ConvertTo-ProcessArgument {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    if ($Value -notmatch '[\s"]') {
        return $Value
    }

    return '"' + ($Value -replace '"', '\"') + '"'
}

function Get-FirstNonEmptyField {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,
        [Parameter(Mandatory = $true)]
        [string[]]$Names
    )

    foreach ($name in $Names) {
        $value = Get-RlpField -Text $Text -Name $name
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value
        }
    }

    return ""
}

function Get-ResolvedReason {
    param(
        [string]$ExplicitReason,
        [string]$Status,
        [string]$StepId,
        [string]$StepTitle
    )

    if (-not [string]::IsNullOrWhiteSpace($ExplicitReason)) {
        return $ExplicitReason
    }

    if ($StepId -and $StepTitle) {
        return "$Status for $StepId $StepTitle."
    }

    return $Status
}

function Get-RlpField {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $match = [regex]::Match($Text, "(?im)^\s*(?:[-*]\s*)?(?:\*\*)?$([regex]::Escape($Name))(?:\*\*)?\s*:\s*(.+?)\s*$")
    if ($match.Success) {
        return $match.Groups[1].Value.Trim()
    }

    return ""
}

function Invoke-CodexCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [Parameter(Mandatory = $true)]
        [string]$InputText,
        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,
        [Parameter(Mandatory = $true)]
        [string]$ResponsePath,
        [Parameter(Mandatory = $true)]
        [int]$ProgressStatusSeconds
    )

    $standardInputPath = [System.IO.Path]::GetTempFileName()
    $standardOutputPath = [System.IO.Path]::GetTempFileName()
    $standardErrorPath = [System.IO.Path]::GetTempFileName()

    $process = $null

    try {
        [System.IO.File]::WriteAllText($standardInputPath, $InputText, (New-Object System.Text.UTF8Encoding($false)))
        $argumentText = ($Arguments | ForEach-Object { ConvertTo-ProcessArgument -Value $_ }) -join " "
        $process = Start-Process -FilePath $Command -ArgumentList $argumentText -WorkingDirectory $WorkingDirectory -RedirectStandardInput $standardInputPath -RedirectStandardOutput $standardOutputPath -RedirectStandardError $standardErrorPath -NoNewWindow -PassThru
        $lastProgressStatusUtc = [DateTime]::UtcNow

        while (-not $process.WaitForExit(1000)) {
            Update-LaneLockHeartbeat
            $nowUtc = [DateTime]::UtcNow
            if ($ProgressStatusSeconds -gt 0 -and ($nowUtc - $lastProgressStatusUtc).TotalSeconds -ge $ProgressStatusSeconds) {
                Write-Host "Codex is still running; final response will be saved to $ResponsePath"
                $lastProgressStatusUtc = $nowUtc
            }
        }

        $process.WaitForExit()
        $exitCode = $process.ExitCode
        $process.Dispose()
        $process = $null

        $standardOutputText = ""
        $standardErrorText = ""
        $outputFilesRead = $false
        for ($readAttempt = 0; -not $outputFilesRead -and $readAttempt -lt 50; $readAttempt++) {
            try {
                $standardOutputText = [System.IO.File]::ReadAllText($standardOutputPath)
                $standardErrorText = [System.IO.File]::ReadAllText($standardErrorPath)
                $outputFilesRead = $true
            }
            catch [System.IO.IOException] {
                if ($readAttempt -eq 49) {
                    throw
                }
                Start-Sleep -Milliseconds 100
            }
        }

        $response = ($standardOutputText + "`n" + $standardErrorText).Trim()
        [System.IO.File]::WriteAllText($ResponsePath, $response, (New-Object System.Text.UTF8Encoding($false)))

        return @{
            ExitCode = $exitCode
            Response = $response
        }
    }
    finally {
        if ($null -ne $process) {
            $process.Dispose()
        }
        Remove-Item -LiteralPath $standardInputPath, $standardOutputPath, $standardErrorPath -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-LaneLockTool {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $laneLockToolPath = Join-Path $PlanDirectory "lane-lock.ts"
    if (-not (Test-Path -LiteralPath $laneLockToolPath -PathType Leaf)) {
        throw "Lane lock tool not found: $laneLockToolPath"
    }

    $output = & bun run $laneLockToolPath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Lane lock tool failed with exit code $LASTEXITCODE."
    }

    return (($output | Out-String).Trim() | ConvertFrom-Json)
}

function Release-LaneLock {
    if ([string]::IsNullOrWhiteSpace($script:SelectedLane) -or [string]::IsNullOrWhiteSpace($script:SelectedLockId)) {
        return
    }

    try {
        Invoke-LaneLockTool -Arguments @(
            "release",
            "--plan-directory", $PlanDirectory,
            "--lock-directory", $LaneLockDirectory,
            "--lane", $script:SelectedLane,
            "--lock-id", $script:SelectedLockId,
            "--lease-minutes", "$LockLeaseMinutes"
        ) | Out-Null
    }
    catch {
        Write-Warning "Failed to release lane lock $($script:SelectedLane): $($_.Exception.Message)"
    }
}

function Resolve-CodexCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    if (Test-Path -LiteralPath $Value -PathType Leaf) {
        $resolvedPath = (Resolve-Path -LiteralPath $Value).Path
        if ($resolvedPath.EndsWith(".ps1", [System.StringComparison]::OrdinalIgnoreCase)) {
            $commandPath = [System.IO.Path]::ChangeExtension($resolvedPath, ".cmd")
            if (Test-Path -LiteralPath $commandPath -PathType Leaf) {
                return $commandPath
            }
        }

        return $resolvedPath
    }

    $command = Get-Command $Value -ErrorAction SilentlyContinue
    if ($command) {
        if ($command.Source.EndsWith(".ps1", [System.StringComparison]::OrdinalIgnoreCase)) {
            $commandPath = [System.IO.Path]::ChangeExtension($command.Source, ".cmd")
            if (Test-Path -LiteralPath $commandPath -PathType Leaf) {
                return $commandPath
            }
        }

        return $command.Source
    }

    return ""
}

function Test-LimitReached {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    return $Text -match "(?im)\b(rate|usage)\s+limit\b" -or $Text -match "(?im)\blimit\s+reached\b"
}

function Test-CodexCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    try {
        $output = & $Value --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            return "Codex CLI command failed version check: $($output | Out-String)"
        }
    }
    catch {
        return "Codex CLI command failed version check: $($_.Exception.Message)"
    }

    return ""
}

function Update-LaneLockHeartbeat {
    if ([string]::IsNullOrWhiteSpace($script:SelectedLane) -or [string]::IsNullOrWhiteSpace($script:SelectedLockId)) {
        return
    }

    Invoke-LaneLockTool -Arguments @(
        "heartbeat",
        "--plan-directory", $PlanDirectory,
        "--lock-directory", $LaneLockDirectory,
        "--lane", $script:SelectedLane,
        "--lock-id", $script:SelectedLockId,
        "--lease-minutes", "$LockLeaseMinutes"
    ) | Out-Null
}

function Write-LoopSummary {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Status,
        [string]$Reason = "",
        [string]$StepId = "",
        [string]$StepTitle = "",
        [string]$ResponsePath = ""
    )

    if ([string]::IsNullOrWhiteSpace($StepId)) {
        $StepId = "NONE"
    }

    if ([string]::IsNullOrWhiteSpace($StepTitle)) {
        $StepTitle = "NONE"
    }

    if ([string]::IsNullOrWhiteSpace($Reason)) {
        $Reason = $Status
    }

    Write-Host "LOOP_STATUS: $Status"
    Write-Host "LOOP_LANE: $script:SelectedLane"
    Write-Host "LOOP_STEP_ID: $StepId"
    Write-Host "LOOP_STEP_TITLE: $StepTitle"
    Write-Host "LOOP_REASON: $Reason"
    if ($ResponsePath) {
        Write-Host "LOOP_RESPONSE_LOG: $ResponsePath"
    }
}

if (-not (Test-Path -LiteralPath $PromptPath -PathType Leaf)) {
    throw "Prompt file not found: $PromptPath"
}

if (-not (Test-Path -LiteralPath $PlanDirectory -PathType Container)) {
    throw "Plan directory not found: $PlanDirectory"
}

if (-not (Test-Path -LiteralPath $WorkingDirectory -PathType Container)) {
    throw "Working directory not found: $WorkingDirectory"
}

if ($LockLeaseMinutes -le 0) {
    throw "LockLeaseMinutes must be greater than zero."
}

if ($MaxIterations -lt 0) {
    throw "MaxIterations must be 0 or greater."
}

if ($ProgressStatusSeconds -lt 0) {
    throw "ProgressStatusSeconds must be 0 or greater."
}

New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null
New-Item -ItemType Directory -Force -Path $LaneLockDirectory | Out-Null

$prompt = Get-Content -LiteralPath $PromptPath -Raw -Encoding utf8
if ([string]::IsNullOrWhiteSpace($prompt)) {
    throw "Prompt file is empty: $PromptPath"
}

if ($MaxIterations -eq 0) {
    Write-Host "Validated prompt path, working directory, log directory, and lane lock directory. MaxIterations is 0, so no Codex invocation was made."
    exit 0
}

$owner = "$env:USERNAME@$env:COMPUTERNAME pid=$PID agent=Codex model=$Model"
$acquireArguments = @(
    "acquire",
    "--plan-directory", $PlanDirectory,
    "--lock-directory", $LaneLockDirectory,
    "--owner", $owner,
    "--owner-process-identifier", "$PID",
    "--lease-minutes", "$LockLeaseMinutes"
)
if (-not [string]::IsNullOrWhiteSpace($Lane)) {
    $acquireArguments += @("--lane", $Lane)
}

$lockResult = Invoke-LaneLockTool -Arguments $acquireArguments
if (-not $lockResult.acquired) {
    Write-LoopSummary -Status "NO_ELIGIBLE_STEP" -Reason $lockResult.reason
    exit 0
}

$script:SelectedLane = $lockResult.lane
$script:SelectedLockId = $lockResult.lockId
$script:SelectedStepId = $lockResult.stepId
$script:SelectedStepTitle = $lockResult.stepTitle

try {
    $executionAgent = "Codex"
    $executionModel = $Model
    if ([string]::IsNullOrWhiteSpace($executionModel)) {
        $executionModel = "codex-cli-default-unspecified"
    }
    $executionEffort = $Effort
    $prompt = Add-ExecutionMetadata -PromptText $prompt -Agent $executionAgent -Model $executionModel -Effort $executionEffort -LaneName $script:SelectedLane -LockId $script:SelectedLockId -InitialStepId $script:SelectedStepId -InitialStepTitle $script:SelectedStepTitle

    $resolvedCodexCommand = Resolve-CodexCommand -Value $CodexCommand
    if (-not $resolvedCodexCommand) {
        Write-LoopSummary -Status "CLI_ERROR" -Reason "Codex CLI command not found: $CodexCommand. Install the Codex CLI and restart PowerShell so codex is on PATH, or pass -CodexCommand with the full CLI path."
        exit 2
    }

    $codexCommandError = Test-CodexCommand -Value $resolvedCodexCommand
    if ($codexCommandError) {
        Write-LoopSummary -Status "CLI_ERROR" -Reason "$codexCommandError Install the Codex CLI terminal command and restart PowerShell, or pass -CodexCommand with the full CLI path."
        exit 2
    }

    $codexReasoningEffort = ConvertTo-CodexReasoningEffort -Value $Effort
    $codexArguments = @(
        "--ask-for-approval", "never",
        "exec",
        "--color", "never",
        "--sandbox", "danger-full-access",
        "-c", "model_reasoning_effort=$codexReasoningEffort"
    )

    if (-not [string]::IsNullOrWhiteSpace($Model)) {
        $codexArguments += @("--model", $Model)
    }

    $codexArguments += "-"

    Push-Location -LiteralPath $WorkingDirectory
    try {
        $iteration = 1

        while ($iteration -le $MaxIterations) {
            Update-LaneLockHeartbeat
            $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
            $responsePath = Join-Path $LogDirectory ("loop_{0}_{1:D4}_{2}.txt" -f $script:SelectedLane, $iteration, $timestamp)

            Write-Host "Iteration $iteration"
            Write-Host "Prompt: $PromptPath"
            Write-Host "Working directory: $WorkingDirectory"
            Write-Host "Lane: $script:SelectedLane"
            Write-Host "Lane lock id: $script:SelectedLockId"
            Write-Host "Initial eligible step: $script:SelectedStepId $script:SelectedStepTitle"
            Write-Host "Codex command: $resolvedCodexCommand"
            Write-Host "Codex arguments: $($codexArguments -join ' ')"
            Write-Host "Execution agent: $executionAgent"
            Write-Host "Execution model: $executionModel"
            Write-Host "Execution effort: $executionEffort"
            Write-Host "Saving final response to $responsePath"

            $result = Invoke-CodexCommand -Command $resolvedCodexCommand -Arguments $codexArguments -InputText $prompt -WorkingDirectory $WorkingDirectory -ResponsePath $responsePath -ProgressStatusSeconds $ProgressStatusSeconds
            $response = $result.Response
            $exitCode = $result.ExitCode

            Write-Host "Saved response to $responsePath"

            if (Test-LimitReached -Text $response) {
                Write-LoopSummary -Status "LIMIT_REACHED" -Reason "Codex reported a rate or usage limit." -ResponsePath $responsePath
                exit 3
            }

            if ($exitCode -ne 0 -and -not $response.Trim()) {
                Write-LoopSummary -Status "CLI_ERROR" -Reason "Codex exited with code $exitCode and produced no response body." -ResponsePath $responsePath
                $iteration++
                if ($SleepSeconds -gt 0) {
                    Start-Sleep -Seconds $SleepSeconds
                }
                continue
            }

            $rawStatus = Get-RlpField -Text $response -Name "RLP_STATUS"
            $status = ConvertTo-CanonicalRlpStatus -Value $rawStatus
            $stepId = Get-FirstNonEmptyField -Text $response -Names @("RLP_STEP_ID", "step")
            $stepTitle = Get-FirstNonEmptyField -Text $response -Names @("RLP_STEP_TITLE", "name")
            $reason = Get-FirstNonEmptyField -Text $response -Names @("RLP_REASON", "reason")

            if (-not $status) {
                if ($exitCode -ne 0) {
                    Write-LoopSummary -Status "CLI_ERROR" -Reason "Codex exited with code $exitCode and did not emit RLP_STATUS." -ResponsePath $responsePath
                    $iteration++
                    if ($SleepSeconds -gt 0) {
                        Start-Sleep -Seconds $SleepSeconds
                    }
                    continue
                }

                Write-LoopSummary -Status "UNKNOWN_STATUS" -Reason "Codex response omitted or malformed RLP_STATUS." -ResponsePath $responsePath
                $iteration++
                if ($SleepSeconds -gt 0) {
                    Start-Sleep -Seconds $SleepSeconds
                }
                continue
            }

            $reason = Get-ResolvedReason -ExplicitReason $reason -Status $status -StepId $stepId -StepTitle $stepTitle

            switch ($status) {
                "COMPLETED" {
                    Write-LoopSummary -Status $status -Reason $reason -StepId $stepId -StepTitle $stepTitle -ResponsePath $responsePath
                }
                "BLOCKED" {
                    Write-LoopSummary -Status $status -Reason $reason -StepId $stepId -StepTitle $stepTitle -ResponsePath $responsePath
                    exit 1
                }
                "NO_ELIGIBLE_STEP" {
                    Write-LoopSummary -Status $status -Reason $reason -StepId $stepId -StepTitle $stepTitle -ResponsePath $responsePath
                    exit 0
                }
                "LIMIT_REACHED" {
                    Write-LoopSummary -Status $status -Reason $reason -StepId $stepId -StepTitle $stepTitle -ResponsePath $responsePath
                    exit 3
                }
                default {
                    Write-LoopSummary -Status "UNKNOWN_STATUS" -Reason "Codex returned an unrecognized RLP_STATUS value: $status" -StepId $stepId -StepTitle $stepTitle -ResponsePath $responsePath
                }
            }

            $iteration++
            if ($SleepSeconds -gt 0) {
                Start-Sleep -Seconds $SleepSeconds
            }
        }

        Write-LoopSummary -Status "MAX_ITERATIONS_REACHED" -Reason "Reached MaxIterations without a terminal loop status."
        exit 0
    }
    finally {
        Pop-Location
    }
}
finally {
    Release-LaneLock
}
