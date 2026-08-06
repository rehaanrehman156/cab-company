# Terraform for Cab Company

This Terraform stack creates:
- EKS Auto Mode cluster
- IAM roles and policy attachments required by EKS Auto Mode
- Optional IRSA IAM role for backend runtime access to AWS Secrets Manager
- Optional ECR repositories for backend and frontend images
- Optional S3 static website bucket for the frontend
- Optional RDS MySQL instance for backend data

## Prerequisites
- Terraform >= 1.6
- AWS CLI configured and authenticated
- IAM permissions to create EKS, IAM roles/policies, and ECR repositories

## AWS Credentials (PowerShell)
Use these once per terminal session before running Terraform:

```powershell
Remove-Item Env:AWS_ACCESS_KEY_ID -ErrorAction SilentlyContinue
Remove-Item Env:AWS_SECRET_ACCESS_KEY -ErrorAction SilentlyContinue
Remove-Item Env:AWS_SESSION_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:AWS_CREDENTIAL_EXPIRATION -ErrorAction SilentlyContinue
$env:AWS_PROFILE = "default"
$env:AWS_REGION = "ap-south-1"
$env:AWS_PAGER = ""
aws login
```

This avoids stale environment credentials causing `ExpiredToken` errors.

## Quick Start
1. Copy example vars:

```powershell
Copy-Item terraform.tfvars.example terraform.tfvars
```

2. Edit `terraform.tfvars` if needed.

3. Deploy:

```powershell
terraform init
terraform plan
terraform apply
```

4. Configure kubectl:

```powershell
aws eks update-kubeconfig --region <region> --name <cluster-name>
kubectl get nodes
```

Replace `<region>` and `<cluster-name>` with your values from outputs.

## Frontend Deployment to S3
1. Apply Terraform and note the `frontend_bucket_name` output.

2. Build the React frontend:

```powershell
cd ../frontend/customer-app
npm install
npm run build
```

3. Upload the static build to S3:

```powershell
aws s3 sync build s3://<frontend-bucket-name> --delete
```

4. Open the `frontend_website_endpoint` output in a browser.

## Notes
- If `use_default_vpc = true` and `subnet_ids = []`, Terraform picks all subnets from your default VPC.
- For production, provide dedicated VPC subnet IDs explicitly in `subnet_ids`.
- EKS cluster creation can take 10-20 minutes.
- S3 website hosting is public by design in this starter setup. For production, prefer CloudFront in front of a private bucket.

## Backend Runtime Secrets (AWS Secrets Manager)
1. Create a secret in AWS Secrets Manager with JSON key/value pairs.
2. Set `backend_secrets_manager_secret_arn` in `terraform.tfvars`.
3. Run `terraform apply` and note `backend_irsa_role_arn` output.
4. Set `eks.amazonaws.com/role-arn` in `kubernetes/backend-serviceaccount.yaml`.
5. Apply Kubernetes manifests.

At runtime, backend loads the secret referenced by `APP_SECRETS_MANAGER_SECRET_ID` and exports JSON keys into process environment variables.

## Optional MySQL Database (RDS)
1. In `terraform.tfvars`, set:
	- `create_mysql_database = true`
	- `mysql_master_password = "<strong-password>"`
2. Run `terraform apply`.
3. Read outputs:
	- `mysql_endpoint`
	- `mysql_port`
	- `mysql_db_name`
	- `mysql_username`
4. Store these values (plus password) in AWS Secrets Manager under the backend secret as:
	- `DB_HOST`
	- `DB_PORT`
	- `DB_NAME`
	- `DB_USER`
	- `DB_PASSWORD`
