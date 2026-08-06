param(
  [ValidateSet("dev", "staging", "prod")]
  [string]$Environment = "dev",
  [string]$BucketName = "",
  [string]$Profile = "",
  [string]$Region = "",
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$configPath = Join-Path $scriptDir "deploy-environments.json"
if (-not (Test-Path $configPath)) {
  throw "Missing deploy environment config file: $configPath"
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json
$envConfig = $config.$Environment
if (-not $envConfig) {
  throw "Environment '$Environment' not found in deploy-environments.json"
}

if ($BucketName -eq "") {
  $BucketName = $envConfig.bucketName
}
if ($Profile -eq "") {
  $Profile = $envConfig.profile
}
if ($Region -eq "") {
  $Region = $envConfig.region
}

Write-Host "Preparing AWS credentials..." -ForegroundColor Cyan
Remove-Item Env:AWS_ACCESS_KEY_ID -ErrorAction SilentlyContinue
Remove-Item Env:AWS_SECRET_ACCESS_KEY -ErrorAction SilentlyContinue
Remove-Item Env:AWS_SESSION_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:AWS_CREDENTIAL_EXPIRATION -ErrorAction SilentlyContinue

$env:AWS_PROFILE = $Profile
$env:AWS_REGION = $Region
$env:AWS_PAGER = ""

Invoke-Expression (aws configure export-credentials --profile $Profile --format powershell | Out-String)

if (-not $SkipInstall) {
  Write-Host "Installing dependencies..." -ForegroundColor Cyan
  npm install
}

Write-Host "Building frontend..." -ForegroundColor Cyan
npm run build

Write-Host "Uploading versioned assets with long cache..." -ForegroundColor Cyan
aws s3 sync build "s3://$BucketName" --delete --exclude "*.html" --cache-control "public,max-age=31536000,immutable"

Write-Host "Uploading HTML with no-cache..." -ForegroundColor Cyan
aws s3 sync build "s3://$BucketName" --exclude "*" --include "*.html" --cache-control "no-cache,no-store,must-revalidate"

$websiteUrl = "http://$BucketName.s3-website-$Region.amazonaws.com"
Write-Host "Deployment complete." -ForegroundColor Green
Write-Host "Frontend URL: $websiteUrl" -ForegroundColor Green
