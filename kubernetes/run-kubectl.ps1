param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$KubectlArgs
)

$ErrorActionPreference = "Stop"

if (-not $KubectlArgs -or $KubectlArgs.Count -eq 0) {
  $KubectlArgs = @("get", "nodepools")
}

# Clear stale session credentials that can override fresh profile credentials.
Remove-Item Env:AWS_ACCESS_KEY_ID -ErrorAction SilentlyContinue
Remove-Item Env:AWS_SECRET_ACCESS_KEY -ErrorAction SilentlyContinue
Remove-Item Env:AWS_SESSION_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:AWS_CREDENTIAL_EXPIRATION -ErrorAction SilentlyContinue

$env:AWS_PROFILE = "default"
$env:AWS_REGION = "ap-south-1"
$env:AWS_PAGER = ""

# Export fresh credentials from the profile and execute kubectl.
Invoke-Expression (aws configure export-credentials --profile $env:AWS_PROFILE --format powershell | Out-String)

Write-Host "Running: kubectl $($KubectlArgs -join ' ')" -ForegroundColor Green
kubectl @KubectlArgs
