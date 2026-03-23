# PowerShell Script: Claude Code Environment Helper
# Usage: .\claude_code_helper.ps1 [-Mode <mode>] [-EnableDangerousPermit] [-ClaudeCmd <path>] [-- <claude-args>...]

# Manual argument parsing to handle --resume and other claude args correctly
$Mode = ""
$EnableDangerousPermit = $false
$ClaudeCmd = "claude"
$ClaudeArgs = @()

$i = 0
while ($i -lt $args.Count) {
    $arg = $args[$i]
    switch ($arg) {
        "-Mode" {
            $i++
            $Mode = $args[$i]
        }
        "-EnableDangerousPermit" {
            $EnableDangerousPermit = $true
        }
        "-ClaudeCmd" {
            $i++
            $ClaudeCmd = $args[$i]
        }
        "--" {
            # All remaining args go to claude
            $i++
            while ($i -lt $args.Count) {
                $ClaudeArgs += $args[$i]
                $i++
            }
            break
        }
        Default {
            # Unknown args go to claude (like --resume, session-id, etc.)
            $ClaudeArgs += $arg
        }
    }
    $i++
}

# Get Mode from environment variable if not specified
if ([string]::IsNullOrEmpty($Mode)) {
    $Mode = $env:USE_MODEL
}

# Reliable way to get user home directory
function Get-UserHome {
    $userHomePath = [Environment]::GetFolderPath('UserProfile')
    if (-not [string]::IsNullOrEmpty($userHomePath)) {
        return $userHomePath
    }
    $userHomePath = $env:USERPROFILE
    if (-not [string]::IsNullOrEmpty($userHomePath)) {
        return $userHomePath
    }
    $userHomePath = $env:HOME
    if (-not [string]::IsNullOrEmpty($userHomePath)) {
        return $userHomePath
    }
    if (-not [string]::IsNullOrEmpty($env:HOMEDRIVE) -and -not [string]::IsNullOrEmpty($env:HOMEPATH)) {
        return "$($env:HOMEDRIVE)$($env:HOMEPATH)"
    }
    throw "Cannot determine user home directory"
}

# Set environment variables based on Mode
if ($Mode -eq "deepseek") {
    $env:DEEPSEEK_API_KEY = "sk-d7e333c16ab743d7a1a2df7e2bfaa96c"
    $env:ANTHROPIC_BASE_URL = "https://api.deepseek.com/anthropic"
    $env:ANTHROPIC_AUTH_TOKEN = $env:DEEPSEEK_API_KEY
    $env:ANTHROPIC_MODEL = "deepseek-chat"
    $env:ANTHROPIC_SMALL_FAST_MODEL = "deepseek-chat"
    $env:ANTHROPIC_DEFAULT_OPUS_MODEL = "deepseek-chat"
    $env:ANTHROPIC_DEFAULT_SONNET_MODEL = "deepseek-chat"
    $env:ANTHROPIC_DEFAULT_HAIKU_MODEL = "deepseek-chat"
    $env:CLAUDE_CODE_SUBAGENT_MODEL = "deepseek-chat"
    $env:CLAUDE_MEM_MODEL = "deepseek-reasoner"
}
elseif ($Mode -eq "glm") {
    $env:ANTHROPIC_BASE_URL = "https://open.bigmodel.cn/api/anthropic"
    # Company account
    $env:ANTHROPIC_AUTH_TOKEN = "34caba8f68014a77a05eb54e7bbf7461.bPK4OAqJtVwi18IS"
    $env:ANTHROPIC_MODEL = "glm-5"
    $env:ANTHROPIC_SMALL_FAST_MODEL = "glm-5"
    $env:ANTHROPIC_DEFAULT_OPUS_MODEL = "glm-5"
    $env:ANTHROPIC_DEFAULT_SONNET_MODEL = "glm-5"
    $env:ANTHROPIC_DEFAULT_HAIKU_MODEL = "glm-5"
    $env:CLAUDE_CODE_SUBAGENT_MODEL = "glm-5"
    $env:CLAUDE_MEM_MODEL = "glm-5"
}
elseif ($Mode -eq "kimi") {
    $env:ANTHROPIC_BASE_URL = "https://api.kimi.com/coding/"
    $env:ANTHROPIC_AUTH_TOKEN = "sk-kimi-xSh4Bpxq4PHCB2DeM8n7nTKM8WvqRcd3OIkONJLEVkso5tds0gcfBAYS4URK4Pwy"
    $env:ANTHROPIC_MODEL = "kimi-for-coding"
    $env:ANTHROPIC_SMALL_FAST_MODEL = "kimi-for-coding"
    $env:ANTHROPIC_DEFAULT_OPUS_MODEL = "kimi-for-coding"
    $env:ANTHROPIC_DEFAULT_SONNET_MODEL = "kimi-for-coding"
    $env:ANTHROPIC_DEFAULT_HAIKU_MODEL = "kimi-for-coding"
    $env:CLAUDE_CODE_SUBAGENT_MODEL = "kimi-k2-for-coding"
    $env:CLAUDE_MEM_MODEL = "kimi-k2-for-coding"
}
elseif ($Mode -eq "qwen") {
    $env:ANTHROPIC_AUTH_TOKEN = "sk-sp-817707961a3747fda63bb5344f1d6522"
    $env:ANTHROPIC_BASE_URL = "https://coding.dashscope.aliyuncs.com/apps/anthropic"
    $env:ANTHROPIC_MODEL = "qwen3-coder-plus"
    $env:CLAUDE_MEM_MODEL = "qwen3-max-2026-01-23"
}
elseif ($Mode -eq "baidu") {
    $env:ANTHROPIC_BASE_URL = "https://qianfan.baidubce.com/anthropic/coding"
    $env:ANTHROPIC_AUTH_TOKEN = "bce-v3/ALTAKSP-DZ0q6JfKfyTChJkBXtMpp/a1c892a1582684bf18365654bb1b42bce074f6f3"
    $env:ANTHROPIC_MODEL = "glm-5"
    $env:ANTHROPIC_SMALL_FAST_MODEL = "glm-5"
    $env:ANTHROPIC_DEFAULT_OPUS_MODEL = "kimi-k2.5"
    $env:ANTHROPIC_DEFAULT_SONNET_MODEL = "deepseek-v3.2"
    $env:ANTHROPIC_DEFAULT_HAIKU_MODEL = "glm-5"
    $env:CLAUDE_CODE_SUBAGENT_MODEL = "opus"
    $env:CLAUDE_MEM_MODEL = "deepseek-v3.2"
}
else {
    Write-Host "Warning: No valid model specified (deepseek/glm/kimi/qwen/baidu)" -ForegroundColor Yellow
    Write-Host "Current Mode value: '$Mode'" -ForegroundColor Yellow
}

# Common environment variables
$env:ENABLE_LSP_TOOL = "1"
$env:API_TIMEOUT_MS = "600000"
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1"
$env:CLAUDE_CODE_EFFORT_LEVEL = "max"
$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"
$env:CLAUDE_CODE_ATTRIBUTION_HEADER = "0"

# Get user home directory
$userHome = Get-UserHome
$settingsPath = Join-Path $userHome ".claude\settings.json"
$settingsDir = Split-Path $settingsPath -Parent

Write-Host "User home: $userHome" -ForegroundColor Cyan
Write-Host "Settings path: $settingsPath" -ForegroundColor Cyan

# Ensure directory exists
if (-not (Test-Path $settingsDir)) {
    New-Item -ItemType Directory -Path $settingsDir -Force | Out-Null
    Write-Host "Created directory: $settingsDir" -ForegroundColor Green
}

# Read existing settings
$curSettings = @{}
if (Test-Path $settingsPath) {
    try {
        $jsonContent = Get-Content $settingsPath -Raw
        $curSettings = $jsonContent | ConvertFrom-Json
        Write-Host "Loaded existing settings" -ForegroundColor Green
    }
    catch {
        Write-Host "Warning: Cannot parse existing settings, will create new one" -ForegroundColor Yellow
        $curSettings = @{}
    }
}

# Ensure env object exists
if ($null -eq $curSettings.env) {
    $envObj = @{}
    $curSettings | Add-Member -MemberType NoteProperty -Name "env" -Value $envObj -Force
}

# Environment variables to sync
$envVars = @(
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_MODEL",
    "ANTHROPIC_SMALL_FAST_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "CLAUDE_CODE_SUBAGENT_MODEL",
    "CLAUDE_MEM_MODEL",
    "ENABLE_LSP_TOOL",
    "API_TIMEOUT_MS",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
    "CLAUDE_CODE_EFFORT_LEVEL",
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS",
    "CLAUDE_CODE_ATTRIBUTION_HEADER"
)

$updatedCount = 0
foreach ($var in $envVars) {
    $value = [Environment]::GetEnvironmentVariable($var)
    if (-not [string]::IsNullOrEmpty($value)) {
        if ($curSettings.env.PSObject.Properties.Match($var)) {
            $curSettings.env.$var = $value
        }
        else {
            $curSettings.env | Add-Member -MemberType NoteProperty -Name $var -Value $value -Force
        }
        $updatedCount++
    }
}

# Save settings
try {
    $jsonOutput = $curSettings | ConvertTo-Json -Depth 10
    $jsonOutput | Set-Content $settingsPath -Encoding UTF8
    Write-Host "Synced $updatedCount environment variables to settings" -ForegroundColor Green
}
catch {
    Write-Host "Error: Cannot save settings file - $_" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Using model: $Mode" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if dangerous permit is enabled (via parameter or environment variable)
$useDangerousPermit = $EnableDangerousPermit -or ($env:ENABLE_DANGEROUS_PERMIT -eq "enable")

# Validate Claude command exists
$claudeExe = Get-Command $ClaudeCmd -ErrorAction SilentlyContinue
if (-not $claudeExe) {
    Write-Host "Error: Cannot find '$ClaudeCmd' command in PATH" -ForegroundColor Red
    Write-Host "Please ensure Claude Code is installed and accessible" -ForegroundColor Red
    exit 1
}

# Build the full command arguments
$fullArgs = @()
if ($useDangerousPermit) {
    Write-Host "Starting Claude Code (bypassPermissions mode)" -ForegroundColor Yellow
    $fullArgs += "--permission-mode", "bypassPermissions", "--allow-dangerously-skip-permissions"
}
else {
    Write-Host "Starting Claude Code" -ForegroundColor Green
}
$fullArgs += "--teammate-mode", "tmux"
$fullArgs += $ClaudeArgs

# Debug output
if ($ClaudeArgs.Count -gt 0) {
    Write-Host "Passing args to claude: $($ClaudeArgs -join ' ')" -ForegroundColor Gray
}

# Start Claude Code
& $claudeExe.Source @fullArgs
