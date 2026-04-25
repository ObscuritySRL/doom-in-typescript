param(
    [string]$PromptPath = "D:\Projects\doom-in-typescript\plan_fps\PRE_PROMPT.md",
    [string]$MasterChecklistPath = "D:\Projects\doom-in-typescript\plan_fps\MASTER_CHECKLIST.md",
    [string]$AuditLogPath = "D:\Projects\doom-in-typescript\plan_fps\AUDIT_LOG.md",
    [string]$WorkingDirectory = "D:\Projects\doom-in-typescript",
    [string]$LogDirectory = "D:\Projects\doom-in-typescript\plan_fps\loop_logs",
    [ValidateSet("low", "medium", "high", "max")]
    [string]$Effort = "max",
    [string]$Model = "claude-opus-4-7",
    [int]$MaxIterations = 2147483647,
    [int]$SleepSeconds = 0
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding

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

function Get-AuditEntryField {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $match = [regex]::Match($Text, "(?im)^\s*-\s*$([regex]::Escape($Name))\s*:\s*(.+?)\s*$")
    if ($match.Success) {
        return $match.Groups[1].Value.Trim()
    }

    return ""
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
        "BLOCKED" {
            return "BLOCKED"
        }
        "BLOCKER" {
            return "BLOCKED"
        }
        "COMPLETE" {
            return "COMPLETED"
        }
        "COMPLETED" {
            return "COMPLETED"
        }
        "DONE" {
            return "COMPLETED"
        }
        "LIMIT" {
            return "LIMIT_REACHED"
        }
        "LIMIT_REACHED" {
            return "LIMIT_REACHED"
        }
        "LIMITREACHED" {
            return "LIMIT_REACHED"
        }
        "NO_ELIGIBLE_AUDIT_STEP" {
            return "NO_ELIGIBLE_STEP"
        }
        "NO_ELIGIBLE_AUDIT_STEPS" {
            return "NO_ELIGIBLE_STEP"
        }
        "NO_ELIGIBLE_STEP" {
            return "NO_ELIGIBLE_STEP"
        }
        "NO_ELIGIBLE_STEPS" {
            return "NO_ELIGIBLE_STEP"
        }
        "OK" {
            return "COMPLETED"
        }
        "RATE_LIMIT" {
            return "LIMIT_REACHED"
        }
        "RATE_LIMITED" {
            return "LIMIT_REACHED"
        }
        "SUCCESS" {
            return "COMPLETED"
        }
        "USAGE_LIMIT" {
            return "LIMIT_REACHED"
        }
        default {
            return ""
        }
    }
}

function Add-AuditExecutionMetadata {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PromptText,
        [Parameter(Mandatory = $true)]
        [string]$Agent,
        [Parameter(Mandatory = $true)]
        [string]$Model,
        [Parameter(Mandatory = $true)]
        [string]$Effort
    )

    return @"
Execution metadata for this Ralph-loop audit invocation:
- agent: $Agent
- model: $Model
- effort: $Effort

Record these exact values in plan_fps/AUDIT_LOG.md entries and in the final RLP_AGENT, RLP_MODEL, and RLP_EFFORT fields.

$PromptText
"@
}

function ConvertTo-AuditTargetText {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$SelectedSteps
    )

    if ($SelectedSteps.Count -eq 0) {
        return "- NONE"
    }

    $lines = foreach ($selectedStep in $SelectedSteps) {
        "- $($selectedStep.Id) $($selectedStep.Title) | file: $($selectedStep.FilePath)"
    }

    return $lines -join [Environment]::NewLine
}

function Add-AuditTargetMetadata {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PromptText,
        [Parameter(Mandatory = $true)]
        [object[]]$SelectedSteps,
        [Parameter(Mandatory = $true)]
        [string]$AuditLogPath
    )

    $targetText = ConvertTo-AuditTargetText -SelectedSteps $SelectedSteps

    return @"
Audit target supplied by the audit-only launcher:
- audit_log: $AuditLogPath
- selected_count: $($SelectedSteps.Count)
- selected_steps:
$targetText

Audit exactly the selected steps above. Do not select replacement or additional steps. If any selected step is no longer marked complete or already has an audit log entry for this execution agent, report RLP_STATUS: BLOCKED and explain the audit ledger mismatch.

$PromptText
"@
}

function Test-LimitReached {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    $patterns = @(
        "You('ve| have)? hit your limit",
        "\blimit reached\b",
        "resets\s+\d{1,2}(:\d{2})?(am|pm)"
    )

    foreach ($pattern in $patterns) {
        if ($Text -match $pattern) {
            return $true
        }
    }

    return $false
}

function Get-CompletedChecklistSteps {
    param(
        [Parameter(Mandatory = $true)]
        [string]$MasterChecklistPath
    )

    $steps = @()
    $checklistLines = Get-Content -LiteralPath $MasterChecklistPath -Encoding utf8
    $checklistPattern = '^- \[x\] `(?<StepId>[0-9]{2}-[0-9]{3})` `(?<StepTitle>[^`]+)` \| prereqs: `[^`]+` \| file: `(?<StepFile>plan_fps/steps/[^`]+\.md)`$'

    foreach ($checklistLine in $checklistLines) {
        $match = [regex]::Match($checklistLine, $checklistPattern)
        if (-not $match.Success) {
            continue
        }

        $steps += [PSCustomObject]@{
            FilePath = $match.Groups["StepFile"].Value
            Id = $match.Groups["StepId"].Value
            Title = $match.Groups["StepTitle"].Value
        }
    }

    return @($steps)
}

function Get-AuditedStepIdMap {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AuditLogPath,
        [Parameter(Mandatory = $true)]
        [string]$Agent
    )

    $auditedStepIdMap = @{}
    $auditLogText = Get-Content -LiteralPath $AuditLogPath -Raw -Encoding utf8
    $auditEntries = [regex]::Matches($auditLogText, "(?ims)^##\s+.+?(?=^##\s+|\z)")

    foreach ($auditEntry in $auditEntries) {
        $entryText = $auditEntry.Value
        $entryAgent = Get-AuditEntryField -Text $entryText -Name "agent"
        $entryStepId = Get-AuditEntryField -Text $entryText -Name "step_id"

        if ([string]::IsNullOrWhiteSpace($entryAgent) -or [string]::IsNullOrWhiteSpace($entryStepId)) {
            continue
        }

        if ($entryAgent.Equals($Agent, [System.StringComparison]::OrdinalIgnoreCase)) {
            $auditedStepIdMap[$entryStepId] = $true
        }
    }

    return $auditedStepIdMap
}

function Select-AuditSteps {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$EligibleSteps
    )

    if ($EligibleSteps.Count -eq 0) {
        return @()
    }

    $maximumSelectionCount = [Math]::Min(3, $EligibleSteps.Count)
    $selectionCount = Get-Random -Minimum 1 -Maximum ($maximumSelectionCount + 1)

    return @($EligibleSteps | Get-Random -Count $selectionCount)
}

function Write-AuditSummary {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Status,
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Reason,
        [string]$AuditedSteps = "NONE",
        [string]$AuditLogUpdated = "UNKNOWN",
        [string]$ResponsePath = ""
    )

    Write-Host "LOOP_STATUS: $Status"
    Write-Host "LOOP_AUDITED_STEPS: $AuditedSteps"
    Write-Host "LOOP_AUDIT_LOG_UPDATED: $AuditLogUpdated"
    Write-Host "LOOP_REASON: $Reason"
    if ($ResponsePath) {
        Write-Host "LOOP_RESPONSE_LOG: $ResponsePath"
    }
}

if (-not (Test-Path -LiteralPath $PromptPath -PathType Leaf)) {
    throw "Prompt file not found: $PromptPath"
}

if (-not (Test-Path -LiteralPath $MasterChecklistPath -PathType Leaf)) {
    throw "Master checklist file not found: $MasterChecklistPath"
}

if (-not (Test-Path -LiteralPath $AuditLogPath -PathType Leaf)) {
    throw "Audit log file not found: $AuditLogPath"
}

if (-not (Test-Path -LiteralPath $WorkingDirectory -PathType Container)) {
    throw "Working directory not found: $WorkingDirectory"
}

if ($MaxIterations -lt 0) {
    throw "MaxIterations must be 0 or greater."
}

New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null

$basePrompt = Get-Content -LiteralPath $PromptPath -Raw -Encoding utf8
if ([string]::IsNullOrWhiteSpace($basePrompt)) {
    throw "Prompt file is empty: $PromptPath"
}

$executionAgent = "Claude Code"
$executionModel = $Model
if ([string]::IsNullOrWhiteSpace($executionModel)) {
    $executionModel = "claude-cli-default-unspecified"
}
$executionEffort = $Effort
$promptWithExecutionMetadata = Add-AuditExecutionMetadata -PromptText $basePrompt -Agent $executionAgent -Model $executionModel -Effort $executionEffort

if ($MaxIterations -eq 0) {
    Write-Host "Validated prompt path, audit log, working directory, and log directory. MaxIterations is 0, so no Claude invocation was made."
    exit 0
}

$claudeArguments = @(
    "--print",
    "--output-format", "text",
    "--dangerously-skip-permissions",
    "--effort", $Effort
)

if (-not [string]::IsNullOrWhiteSpace($Model)) {
    $claudeArguments += @("--model", $Model)
}

Push-Location -LiteralPath $WorkingDirectory
try {
    $iteration = 1

    while ($iteration -le $MaxIterations) {
        $completedSteps = @(Get-CompletedChecklistSteps -MasterChecklistPath $MasterChecklistPath)
        $auditedStepIdMap = Get-AuditedStepIdMap -AuditLogPath $AuditLogPath -Agent $executionAgent
        $eligibleSteps = @($completedSteps | Where-Object { -not $auditedStepIdMap.ContainsKey($_.Id) })

        if ($eligibleSteps.Count -eq 0) {
            Write-AuditSummary -Status "NO_ELIGIBLE_STEP" -Reason "Every completed step already has an audit log entry for $executionAgent." -AuditedSteps "NONE" -AuditLogUpdated "NO"
            exit 0
        }

        $selectedSteps = @(Select-AuditSteps -EligibleSteps $eligibleSteps)
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $responsePath = Join-Path $LogDirectory ("audit_claude_{0:D4}_{1}.txt" -f $iteration, $timestamp)
        $iterationPrompt = Add-AuditTargetMetadata -PromptText $promptWithExecutionMetadata -SelectedSteps $selectedSteps -AuditLogPath $AuditLogPath
        $selectedStepText = (($selectedSteps | ForEach-Object { "$($_.Id) $($_.Title)" }) -join "; ")

        Write-Host "Iteration $iteration"
        Write-Host "Prompt: $PromptPath"
        Write-Host "Audit log: $AuditLogPath"
        Write-Host "Selected audit steps: $selectedStepText"
        Write-Host "Working directory: $WorkingDirectory"
        Write-Host "Claude arguments: $($claudeArguments -join ' ')"
        Write-Host "Execution agent: $executionAgent"
        Write-Host "Execution model: $executionModel"
        Write-Host "Execution effort: $executionEffort"

        $response = $iterationPrompt | & claude @claudeArguments 2>&1 | Out-String
        $exitCode = $LASTEXITCODE

        Set-Content -LiteralPath $responsePath -Value $response -Encoding utf8
        Write-Host "Saved audit response to $responsePath"
        Write-Output $response

        if (Test-LimitReached -Text $response) {
            Write-AuditSummary -Status "LIMIT_REACHED" -Reason "Claude reported a rate or usage limit during audit." -AuditedSteps $selectedStepText -AuditLogUpdated "NO" -ResponsePath $responsePath
            exit 3
        }

        if ($exitCode -ne 0 -and -not $response.Trim()) {
            Write-AuditSummary -Status "CLI_ERROR" -Reason "Claude audit exited with code $exitCode and produced no response body." -AuditedSteps $selectedStepText -AuditLogUpdated "NO" -ResponsePath $responsePath
            $iteration++
            if ($SleepSeconds -gt 0) {
                Start-Sleep -Seconds $SleepSeconds
            }
            continue
        }

        $rawStatus = Get-RlpField -Text $response -Name "RLP_STATUS"
        $status = ConvertTo-CanonicalRlpStatus -Value $rawStatus
        $auditedSteps = Get-FirstNonEmptyField -Text $response -Names @("RLP_AUDITED_STEPS", "RLP_STEP_ID", "step")
        $auditLogUpdated = Get-FirstNonEmptyField -Text $response -Names @("RLP_AUDIT_LOG_UPDATED", "audit_log_updated")
        $reason = Get-FirstNonEmptyField -Text $response -Names @("RLP_REASON", "reason")

        if ([string]::IsNullOrWhiteSpace($auditedSteps)) {
            $auditedSteps = $selectedStepText
        }

        if ([string]::IsNullOrWhiteSpace($auditLogUpdated)) {
            $auditLogUpdated = "NO"
        }
        else {
            $auditLogUpdated = $auditLogUpdated.Trim().ToUpperInvariant()
        }

        if ([string]::IsNullOrWhiteSpace($reason)) {
            $reason = "No RLP_REASON provided by audit response."
        }

        if (-not $status) {
            Write-AuditSummary -Status "STATUS_MISSING" -Reason "Claude audit response omitted or malformed RLP_STATUS." -AuditedSteps $auditedSteps -AuditLogUpdated $auditLogUpdated -ResponsePath $responsePath
            $iteration++
            if ($SleepSeconds -gt 0) {
                Start-Sleep -Seconds $SleepSeconds
            }
            continue
        }

        switch ($status) {
            "COMPLETED" {
                if ($auditLogUpdated -ne "YES") {
                    Write-AuditSummary -Status "AUDIT_LOG_NOT_UPDATED" -Reason "Audit reported COMPLETED without RLP_AUDIT_LOG_UPDATED: YES." -AuditedSteps $auditedSteps -AuditLogUpdated $auditLogUpdated -ResponsePath $responsePath
                    exit 1
                }

                Write-AuditSummary -Status $status -Reason $reason -AuditedSteps $auditedSteps -AuditLogUpdated $auditLogUpdated -ResponsePath $responsePath
            }
            "BLOCKED" {
                Write-AuditSummary -Status $status -Reason $reason -AuditedSteps $auditedSteps -AuditLogUpdated $auditLogUpdated -ResponsePath $responsePath
                exit 1
            }
            "NO_ELIGIBLE_STEP" {
                Write-AuditSummary -Status $status -Reason $reason -AuditedSteps $auditedSteps -AuditLogUpdated $auditLogUpdated -ResponsePath $responsePath
                exit 0
            }
            "LIMIT_REACHED" {
                Write-AuditSummary -Status $status -Reason $reason -AuditedSteps $auditedSteps -AuditLogUpdated $auditLogUpdated -ResponsePath $responsePath
                exit 3
            }
            default {
                Write-AuditSummary -Status "UNKNOWN_STATUS" -Reason "Claude returned an unrecognized audit RLP_STATUS value: $status" -AuditedSteps $auditedSteps -AuditLogUpdated $auditLogUpdated -ResponsePath $responsePath
            }
        }

        $iteration++
        if ($SleepSeconds -gt 0) {
            Start-Sleep -Seconds $SleepSeconds
        }
    }

    Write-AuditSummary -Status "MAX_ITERATIONS_REACHED" -Reason "Reached MaxIterations without exhausting eligible audit steps."
    exit 0
}
finally {
    Pop-Location
}
