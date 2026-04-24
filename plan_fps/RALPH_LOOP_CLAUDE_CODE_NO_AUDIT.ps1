param(
    [string]$PromptPath = "D:\Projects\doom-in-typescript\plan_fps\PROMPT.md",
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

function Get-InferredStepId {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    $match = [regex]::Match($Text, "(?im)\bStep\s+([0-9]{2}-[0-9]{3})\b")
    if ($match.Success) {
        return $match.Groups[1].Value.Trim()
    }

    return ""
}

function Get-InferredStepTitle {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    $match = [regex]::Match($Text, "(?im)^\s*Step\s+[0-9]{2}-[0-9]{3}\s+(.+?)\s+complete\.?\s*$")
    if ($match.Success) {
        return $match.Groups[1].Value.Trim()
    }

    return ""
}

function Get-InferredStatus {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    if (Test-LimitReached -Text $Text) {
        return "LIMIT_REACHED"
    }

    if ($Text -match "(?im)\bno eligible step\b" -or $Text -match "(?im)\bno steps?\s+(?:are\s+)?eligible\b") {
        return "NO_ELIGIBLE_STEP"
    }

    if ($Text -match "(?im)^\s*(?:\*\*)?Next eligible(?:\*\*)?\s*:" -or $Text -match "(?im)\bStep\s+[0-9]{2}-[0-9]{3}\b.+\bcomplete\b") {
        return "COMPLETED"
    }

    if ($Text -match "(?im)^\s*(?:\*\*)?(?:Blocker|Blocked)(?:\*\*)?\s*:" -or $Text -match "(?im)\bI am blocked\b" -or $Text -match "(?im)\bunresolved blocker\b") {
        return "BLOCKED"
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

function Add-ExecutionMetadata {
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
Execution metadata for this Ralph-loop invocation:
- agent: $Agent
- model: $Model
- effort: $Effort

Record these exact values in any `plan_fps/HANDOFF_LOG.md` completion entry and in the final `RLP_AGENT`, `RLP_MODEL`, and `RLP_EFFORT` fields.

$PromptText
"@
}

function Get-ResolvedReason {
    param(
        [string]$ExplicitReason = "",
        [Parameter(Mandatory = $true)]
        [string]$Status,
        [string]$StepId = "",
        [string]$StepTitle = ""
    )

    if (-not [string]::IsNullOrWhiteSpace($ExplicitReason)) {
        return $ExplicitReason.Trim()
    }

    switch ($Status) {
        "COMPLETED" {
            if ($StepId -and $StepTitle) {
                return "No RLP_REASON provided; continuing after completed response for $StepId $StepTitle."
            }
            if ($StepId) {
                return "No RLP_REASON provided; continuing after completed response for $StepId."
            }
            return "No RLP_REASON provided; continuing after completed response."
        }
        "BLOCKED" {
            if ($StepId -and $StepTitle) {
                return "No RLP_REASON provided; treating response as BLOCKED for $StepId $StepTitle."
            }
            return "No RLP_REASON provided; treating response as BLOCKED."
        }
        "NO_ELIGIBLE_STEP" {
            return "No RLP_REASON provided; no eligible step remains."
        }
        "LIMIT_REACHED" {
            return "No RLP_REASON provided; treating response as LIMIT_REACHED."
        }
        default {
            return "No RLP_REASON provided."
        }
    }
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

function Write-LoopSummary {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Status,
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Reason,
        [string]$StepId = "NONE",
        [string]$StepTitle = "NONE",
        [string]$ResponsePath = ""
    )

    Write-Host "LOOP_STATUS: $Status"
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

if (-not (Test-Path -LiteralPath $WorkingDirectory -PathType Container)) {
    throw "Working directory not found: $WorkingDirectory"
}

if ($MaxIterations -lt 0) {
    throw "MaxIterations must be 0 or greater."
}

New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null

$prompt = Get-Content -LiteralPath $PromptPath -Raw -Encoding utf8
if ([string]::IsNullOrWhiteSpace($prompt)) {
    throw "Prompt file is empty: $PromptPath"
}

$executionAgent = "Claude Code"
$executionModel = $Model
if ([string]::IsNullOrWhiteSpace($executionModel)) {
    $executionModel = "claude-cli-default-unspecified"
}
$executionEffort = $Effort
$prompt = Add-ExecutionMetadata -PromptText $prompt -Agent $executionAgent -Model $executionModel -Effort $executionEffort

if ($MaxIterations -eq 0) {
    Write-Host "Validated prompt path, working directory, and log directory. MaxIterations is 0, so no Claude invocation was made."
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
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $repairPath = Join-Path $LogDirectory ("repair_{0:D4}_{1}.txt" -f $iteration, $timestamp)
        $responsePath = Join-Path $LogDirectory ("loop_{0:D4}_{1}.txt" -f $iteration, $timestamp)

        Write-Host "Iteration $iteration"
        Write-Host "Prompt: $PromptPath"
        Write-Host "Working directory: $WorkingDirectory"
        Write-Host "Claude arguments: $($claudeArguments -join ' ')"
        Write-Host "Execution agent: $executionAgent"
        Write-Host "Execution model: $executionModel"
        Write-Host "Execution effort: $executionEffort"

        $response = $prompt | & claude @claudeArguments 2>&1 | Out-String
        $exitCode = $LASTEXITCODE

        Set-Content -LiteralPath $responsePath -Value $response -Encoding utf8
        Write-Host "Saved response to $responsePath"
        Write-Output $response

        if (Test-LimitReached -Text $response) {
            Write-LoopSummary -Status "LIMIT_REACHED" -Reason "Claude reported a rate or usage limit." -ResponsePath $responsePath
            exit 3
        }

        if ($exitCode -ne 0 -and -not $response.Trim()) {
            Write-LoopSummary -Status "CLI_ERROR" -Reason "Claude exited with code $exitCode and produced no response body." -ResponsePath $responsePath
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
                Write-LoopSummary -Status "CLI_ERROR" -Reason "Claude exited with code $exitCode and did not emit RLP_STATUS." -ResponsePath $responsePath
                $iteration++
                if ($SleepSeconds -gt 0) {
                    Start-Sleep -Seconds $SleepSeconds
                }
                continue
            }

            Write-Host "--- Status repair (missing RLP_STATUS) ---"
            $repairPrompt = @"
The following Ralph loop response is missing or has an invalid machine-readable status block.

Return ONLY the status block. Do not repeat the prose summary. Do not use Markdown fences. Do not add commentary.
Each field must be on its own line. Never place RLP_STEP_ID or any other key on the same line as RLP_STATUS.

Use exactly this format:
RLP_STATUS: COMPLETED|BLOCKED|NO_ELIGIBLE_STEP|LIMIT_REACHED
RLP_STEP_ID: <step id or NONE>
RLP_STEP_TITLE: <title or NONE>
RLP_AGENT: $executionAgent
RLP_MODEL: $executionModel
RLP_EFFORT: $executionEffort
RLP_FILES_CHANGED: <semicolon-separated absolute paths or NONE>
RLP_TEST_COMMANDS: <semicolon-separated commands or NONE>
RLP_CHECKLIST_UPDATED: YES|NO
RLP_HANDOFF_UPDATED: YES|NO
RLP_PROGRESS_LOG: KEPT|DELETED|NONE
RLP_NEXT_STEP: <next eligible step id/title or NONE>
RLP_REASON: <one-line reason>

RLP_STATUS must be EXACTLY one of the four uppercase values above.
Do not use variants like complete, ok, done, success, lowercase values, or another field name after RLP_STATUS:.

Interpret the response as follows:
- If it says a step is complete or names a next eligible step, use COMPLETED.
- If it says no eligible step remains, use NO_ELIGIBLE_STEP.
- If it describes a real unresolved blocker, use BLOCKED.
- If it indicates model or usage limits, use LIMIT_REACHED.

Response to convert:
$response
"@

            $repairResponse = $repairPrompt | & claude @claudeArguments 2>&1 | Out-String
            $repairExitCode = $LASTEXITCODE

            Set-Content -LiteralPath $repairPath -Value $repairResponse -Encoding utf8
            Write-Host "Saved repair response to $repairPath"
            Write-Output $repairResponse

            if (Test-LimitReached -Text $repairResponse) {
                Write-LoopSummary -Status "LIMIT_REACHED" -Reason "Claude reported a rate or usage limit during status repair." -ResponsePath $repairPath
                exit 3
            }

            if ($repairExitCode -ne 0 -and -not $repairResponse.Trim()) {
                Write-LoopSummary -Status "CLI_ERROR" -Reason "Claude status repair exited with code $repairExitCode and produced no response body." -ResponsePath $repairPath
                $iteration++
                if ($SleepSeconds -gt 0) {
                    Start-Sleep -Seconds $SleepSeconds
                }
                continue
            }

            $repairRawStatus = Get-RlpField -Text $repairResponse -Name "RLP_STATUS"
            $status = ConvertTo-CanonicalRlpStatus -Value $repairRawStatus
            if (-not $stepId) {
                $stepId = Get-FirstNonEmptyField -Text $repairResponse -Names @("RLP_STEP_ID", "step")
            }
            if (-not $stepTitle) {
                $stepTitle = Get-FirstNonEmptyField -Text $repairResponse -Names @("RLP_STEP_TITLE", "name")
            }
            if (-not $reason) {
                $reason = Get-FirstNonEmptyField -Text $repairResponse -Names @("RLP_REASON", "reason")
            }

            if (-not $status) {
                $inferredStatus = Get-InferredStatus -Text $response
                if (-not $inferredStatus) {
                    $inferredStatus = Get-InferredStatus -Text $repairResponse
                }

                if ($inferredStatus) {
                    $status = $inferredStatus
                    if (-not $stepId) {
                        $stepId = Get-InferredStepId -Text $response
                    }
                    if (-not $stepTitle) {
                        $stepTitle = Get-InferredStepTitle -Text $response
                    }
                    if (-not $reason) {
                        $reason = "Inferred $status after missing RLP_STATUS and failed status repair."
                    }

                    Write-Host "Inferred loop status as $status after failed status repair."
                }
                else {
                    Write-LoopSummary -Status "STATUS_REPAIR_FAILED" -Reason "Claude response omitted or malformed RLP_STATUS and status repair could not recover it." -ResponsePath $repairPath
                    $iteration++
                    if ($SleepSeconds -gt 0) {
                        Start-Sleep -Seconds $SleepSeconds
                    }
                    continue
                }
            }
        }

        $reason = Get-ResolvedReason -ExplicitReason $reason -Status $status -StepId $stepId -StepTitle $stepTitle

        switch ($status) {
            "COMPLETED" {
                Write-LoopSummary -Status $status -Reason $reason -StepId $stepId -StepTitle $stepTitle -ResponsePath $responsePath
            }
            "BLOCKED" {
                Write-LoopSummary -Status $status -Reason $reason -StepId $stepId -StepTitle $stepTitle -ResponsePath $responsePath
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
                Write-LoopSummary -Status "UNKNOWN_STATUS" -Reason "Claude returned an unrecognized RLP_STATUS value: $status" -StepId $stepId -StepTitle $stepTitle -ResponsePath $responsePath
            }
        }

        $iteration++
        if ($SleepSeconds -gt 0) {
            Start-Sleep -Seconds $SleepSeconds
        }
        continue
    }

    Write-LoopSummary -Status "MAX_ITERATIONS_REACHED" -Reason "Reached MaxIterations without a terminal loop status."
    exit 0
}
finally {
    Pop-Location
}
