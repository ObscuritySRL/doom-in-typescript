param(
    [string]$PromptPath = "D:\Projects\doom-in-typescript\plan_fps\PROMPT.md",
    [string]$PrePromptPath = "D:\Projects\doom-in-typescript\plan_fps\PRE_PROMPT.md",
    [string]$WorkingDirectory = "D:\Projects\doom-in-typescript",
    [string]$LogDirectory = "D:\Projects\doom-in-typescript\plan_fps\loop_logs",
    [ValidateSet("minimal", "low", "medium", "high", "xhigh", "max")]
    [string]$Effort = "xhigh",
    [string]$Model = "",
    [string]$CodexCommand = "codex",
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

function Resolve-CodexCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    if (Test-Path -LiteralPath $Value -PathType Leaf) {
        $resolvedPath = (Resolve-Path -LiteralPath $Value).Path
        if ($resolvedPath.EndsWith(".ps1", [System.StringComparison]::OrdinalIgnoreCase)) {
            $cmdPath = [System.IO.Path]::ChangeExtension($resolvedPath, ".cmd")
            if (Test-Path -LiteralPath $cmdPath -PathType Leaf) {
                return $cmdPath
            }
        }

        return $resolvedPath
    }

    $command = Get-Command $Value -ErrorAction SilentlyContinue
    if ($command) {
        if ($command.Source.EndsWith(".ps1", [System.StringComparison]::OrdinalIgnoreCase)) {
            $cmdPath = [System.IO.Path]::ChangeExtension($command.Source, ".cmd")
            if (Test-Path -LiteralPath $cmdPath -PathType Leaf) {
                return $cmdPath
            }
        }

        return $command.Source
    }

    return ""
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
        [string]$ResponsePath
    )

    $diagnosticBuilder = New-Object System.Text.StringBuilder
    $standardInputPath = [System.IO.Path]::GetTempFileName()
    $standardOutputPath = [System.IO.Path]::GetTempFileName()
    $standardErrorPath = [System.IO.Path]::GetTempFileName()
    $lastHeartbeat = [datetime]::UtcNow

    [System.IO.File]::WriteAllText($standardInputPath, $InputText, (New-Object System.Text.UTF8Encoding($false)))
    $executionArguments = New-Object System.Collections.Generic.List[string]
    foreach ($argument in $Arguments) {
        $executionArguments.Add($argument)
        if ($argument -eq "exec") {
            $executionArguments.Add("--output-last-message")
            $executionArguments.Add($ResponsePath)
        }
    }

    $argumentText = ($executionArguments | ForEach-Object { ConvertTo-ProcessArgument -Value $_ }) -join " "
    $process = $null

    try {
        $process = Start-Process -FilePath $Command -ArgumentList $argumentText -WorkingDirectory $WorkingDirectory -RedirectStandardInput $standardInputPath -RedirectStandardOutput $standardOutputPath -RedirectStandardError $standardErrorPath -NoNewWindow -PassThru

        while (-not $process.HasExited) {
            if ((([datetime]::UtcNow) - $lastHeartbeat).TotalSeconds -ge 30) {
                Write-Host "Codex is still running; final response will be saved to $ResponsePath"
                $lastHeartbeat = [datetime]::UtcNow
            }
            Start-Sleep -Milliseconds 200
        }

        $process.WaitForExit()
        $process.Refresh()
        if (Test-Path -LiteralPath $standardOutputPath -PathType Leaf) {
            [void]$diagnosticBuilder.Append((Get-Content -LiteralPath $standardOutputPath -Raw))
        }
        if (Test-Path -LiteralPath $standardErrorPath -PathType Leaf) {
            [void]$diagnosticBuilder.Append((Get-Content -LiteralPath $standardErrorPath -Raw))
        }
    }
    finally {
        Remove-Item -LiteralPath $standardInputPath, $standardOutputPath, $standardErrorPath -Force -ErrorAction SilentlyContinue
    }

    $response = ""
    if (Test-Path -LiteralPath $ResponsePath -PathType Leaf) {
        $response = Get-Content -LiteralPath $ResponsePath -Raw
    }

    if (-not $response.Trim()) {
        $response = $diagnosticBuilder.ToString()
        Set-Content -LiteralPath $ResponsePath -Value $response -Encoding utf8
    }

    $exitCode = 1
    if ($null -ne $process -and $null -ne $process.ExitCode -and "$($process.ExitCode)" -ne "") {
        $exitCode = $process.ExitCode
    }
    elseif ($response.Trim()) {
        $exitCode = 0
    }

    return [PSCustomObject]@{
        ExitCode = $exitCode
        Response = $response
    }
}

function Test-CodexCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    try {
        $versionResponse = & $Value --version 2>&1 | Out-String
        $versionExitCode = $LASTEXITCODE
    }
    catch {
        return "Codex CLI preflight failed for '$Value': $($_.Exception.Message)"
    }

    if ($versionExitCode -ne 0) {
        return "Codex CLI preflight failed for '$Value' with exit code $versionExitCode. Output: $($versionResponse.Trim())"
    }

    return ""
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

if (-not (Test-Path -LiteralPath $PrePromptPath -PathType Leaf)) {
    throw "Pre-prompt file not found: $PrePromptPath"
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

$prePrompt = Get-Content -LiteralPath $PrePromptPath -Raw -Encoding utf8
if ([string]::IsNullOrWhiteSpace($prePrompt)) {
    throw "Pre-prompt file is empty: $PrePromptPath"
}

$executionAgent = "Codex"
$executionModel = $Model
if ([string]::IsNullOrWhiteSpace($executionModel)) {
    $executionModel = "codex-cli-default-unspecified"
}
$executionEffort = $Effort
$prompt = Add-ExecutionMetadata -PromptText $prompt -Agent $executionAgent -Model $executionModel -Effort $executionEffort
$prePrompt = Add-ExecutionMetadata -PromptText $prePrompt -Agent $executionAgent -Model $executionModel -Effort $executionEffort

if ($MaxIterations -eq 0) {
    Write-Host "Validated prompt path, working directory, and log directory. MaxIterations is 0, so no Codex invocation was made."
    exit 0
}

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
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $prePath = Join-Path $LogDirectory ("pre_{0:D4}_{1}.txt" -f $iteration, $timestamp)
        $repairPath = Join-Path $LogDirectory ("repair_{0:D4}_{1}.txt" -f $iteration, $timestamp)
        $responsePath = Join-Path $LogDirectory ("loop_{0:D4}_{1}.txt" -f $iteration, $timestamp)

        Write-Host "Iteration $iteration"
        Write-Host "Pre-prompt: $PrePromptPath"
        Write-Host "Prompt: $PromptPath"
        Write-Host "Working directory: $WorkingDirectory"
        Write-Host "Codex command: $resolvedCodexCommand"
        Write-Host "Codex arguments: $($codexArguments -join ' ')"
        Write-Host "Execution agent: $executionAgent"
        Write-Host "Execution model: $executionModel"
        Write-Host "Execution effort: $executionEffort"

        Write-Host "--- Audit pass (PRE_PROMPT.md) ---"
        Write-Host "Saving final pre-prompt response to $prePath"
        $preResult = Invoke-CodexCommand -Command $resolvedCodexCommand -Arguments $codexArguments -InputText $prePrompt -WorkingDirectory $WorkingDirectory -ResponsePath $prePath
        $preResponse = $preResult.Response
        $preExitCode = $preResult.ExitCode

        Write-Host "Saved pre-prompt response to $prePath"

        if (Test-LimitReached -Text $preResponse) {
            Write-LoopSummary -Status "LIMIT_REACHED" -Reason "Codex reported a rate or usage limit during audit pass." -ResponsePath $prePath
            exit 3
        }

        if ($preExitCode -ne 0 -and -not $preResponse.Trim()) {
            Write-LoopSummary -Status "CLI_ERROR" -Reason "Codex audit pass exited with code $preExitCode and produced no response body." -ResponsePath $prePath
            $iteration++
            if ($SleepSeconds -gt 0) {
                Start-Sleep -Seconds $SleepSeconds
            }
            continue
        }

        $preRawStatus = Get-RlpField -Text $preResponse -Name "RLP_STATUS"
        $preStatus = ConvertTo-CanonicalRlpStatus -Value $preRawStatus
        if ($preStatus -eq "LIMIT_REACHED") {
            Write-LoopSummary -Status "LIMIT_REACHED" -Reason "Audit pass emitted RLP_STATUS: LIMIT_REACHED." -ResponsePath $prePath
            exit 3
        }

        Write-Host "--- Forward step (PROMPT.md) ---"
        Write-Host "Saving final response to $responsePath"
        $result = Invoke-CodexCommand -Command $resolvedCodexCommand -Arguments $codexArguments -InputText $prompt -WorkingDirectory $WorkingDirectory -ResponsePath $responsePath
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

            Write-Host "Saving final repair response to $repairPath"
            $repairResult = Invoke-CodexCommand -Command $resolvedCodexCommand -Arguments $codexArguments -InputText $repairPrompt -WorkingDirectory $WorkingDirectory -ResponsePath $repairPath
            $repairResponse = $repairResult.Response
            $repairExitCode = $repairResult.ExitCode

            Write-Host "Saved repair response to $repairPath"

            if (Test-LimitReached -Text $repairResponse) {
                Write-LoopSummary -Status "LIMIT_REACHED" -Reason "Codex reported a rate or usage limit during status repair." -ResponsePath $repairPath
                exit 3
            }

            if ($repairExitCode -ne 0 -and -not $repairResponse.Trim()) {
                Write-LoopSummary -Status "CLI_ERROR" -Reason "Codex status repair exited with code $repairExitCode and produced no response body." -ResponsePath $repairPath
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
                    Write-LoopSummary -Status "STATUS_REPAIR_FAILED" -Reason "Codex response omitted or malformed RLP_STATUS and status repair could not recover it." -ResponsePath $repairPath
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
                Write-LoopSummary -Status "UNKNOWN_STATUS" -Reason "Codex returned an unrecognized RLP_STATUS value: $status" -StepId $stepId -StepTitle $stepTitle -ResponsePath $responsePath
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

