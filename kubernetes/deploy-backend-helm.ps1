param(
  [string]$Namespace = "cab-company",
  [string]$ReleaseName = "cab-backend",
  [string]$TerraformDir = "..\terraform",
  [string]$ChartPath = ".\helm\cab-backend",
  [switch]$WaitRollout
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

if (-not (Get-Command helm -ErrorAction SilentlyContinue)) {
  throw "Helm is not installed. Install Helm and retry."
}

$terraformPath = Resolve-Path $TerraformDir -ErrorAction Stop
$resolvedChartPath = Resolve-Path $ChartPath -ErrorAction Stop

Write-Host "Reading backend IRSA role ARN from Terraform output..." -ForegroundColor Cyan
$roleArn = terraform "-chdir=$terraformPath" output -raw backend_irsa_role_arn

if ([string]::IsNullOrWhiteSpace($roleArn) -or $roleArn -eq "null") {
  throw "backend_irsa_role_arn is empty. Set backend_secrets_manager_secret_arn in terraform.tfvars, run terraform apply, then retry."
}

$tempValuesFile = [System.IO.Path]::GetTempFileName()

try {
  @"
serviceAccount:
  annotations:
    eks.amazonaws.com/role-arn: "$roleArn"
"@ | Set-Content -Path $tempValuesFile -Encoding utf8

  Write-Host "Deploying backend with Helm release '$ReleaseName' in namespace '$Namespace'..." -ForegroundColor Cyan
  helm upgrade --install $ReleaseName $resolvedChartPath --namespace $Namespace --create-namespace -f (Join-Path $resolvedChartPath "values.yaml") -f $tempValuesFile

  if ($WaitRollout) {
    Write-Host "Waiting for backend rollout..." -ForegroundColor Cyan
    kubectl rollout status deployment/cab-backend -n $Namespace --timeout=300s
  }

  Write-Host "Helm deploy successful. IRSA role injected: $roleArn" -ForegroundColor Green
}
finally {
  Remove-Item $tempValuesFile -ErrorAction SilentlyContinue
}
