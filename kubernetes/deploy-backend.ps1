param(
  [string]$Namespace = "cab-company",
  [string]$TerraformDir = "..\terraform",
  [switch]$WaitRollout
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$terraformPath = Resolve-Path $TerraformDir -ErrorAction Stop

Write-Host "Reading IRSA role ARN from Terraform output..." -ForegroundColor Cyan
$roleArn = terraform "-chdir=$terraformPath" output -raw backend_irsa_role_arn

if ([string]::IsNullOrWhiteSpace($roleArn) -or $roleArn -eq "null") {
  throw "backend_irsa_role_arn is empty. Set backend_secrets_manager_secret_arn in terraform.tfvars, run terraform apply, then retry."
}

Write-Host "Rendering Kubernetes manifests and injecting IRSA role annotation..." -ForegroundColor Cyan
$rendered = kubectl kustomize "$scriptDir"

if ([string]::IsNullOrWhiteSpace($rendered)) {
  throw "kubectl kustomize returned empty output."
}

$rendered = $rendered.Replace("REPLACE_WITH_BACKEND_IRSA_ROLE_ARN", $roleArn)

$tempFile = [System.IO.Path]::GetTempFileName()

try {
  Set-Content -Path $tempFile -Value $rendered -Encoding utf8

  Write-Host "Applying manifests to cluster..." -ForegroundColor Cyan
  kubectl apply -f $tempFile

  if ($WaitRollout) {
    Write-Host "Waiting for backend rollout..." -ForegroundColor Cyan
    kubectl rollout status deployment/cab-backend -n $Namespace --timeout=300s
  }

  Write-Host "Backend deployment applied with IRSA role: $roleArn" -ForegroundColor Green
}
finally {
  Remove-Item $tempFile -ErrorAction SilentlyContinue
}
