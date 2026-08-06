# Deploy Cab Company

## Architecture
- Frontend: S3 static website hosting
- Backend: EKS
- Backend packaging: Helm chart (`kubernetes/helm/cab-backend`)

## 1) Login and use cluster

```powershell
aws login
aws eks update-kubeconfig --region ap-south-1 --name cab-company-eks-auto
```

## 2) Login Docker to ECR

```powershell
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 328064416060.dkr.ecr.ap-south-1.amazonaws.com
```

## 3) Build and push backend image

```powershell
cd ../backend
docker build -t cab-company-dev-backend:latest .
docker tag cab-company-dev-backend:latest 328064416060.dkr.ecr.ap-south-1.amazonaws.com/cab-company-dev-backend:latest
docker push 328064416060.dkr.ecr.ap-south-1.amazonaws.com/cab-company-dev-backend:latest
```

## 4) Deploy frontend to S3

```powershell
cd ../frontend/customer-app
npm run deploy:s3
```

Fast path (skip npm install):

```powershell
npm run deploy:s3:fast
```

Staging/Production variants:

```powershell
npm run deploy:s3:staging
npm run deploy:s3:staging:fast
npm run deploy:s3:prod
npm run deploy:s3:prod:fast
```

Replace staging/prod bucket names in `package.json` scripts with your real bucket names when you create them.
Update bucket/profile/region values in `frontend/customer-app/deploy-environments.json`.

## 5) Create backend runtime secret in AWS Secrets Manager

Store your backend secrets as a single JSON document:

```powershell
aws secretsmanager create-secret `
	--name cab-company/dev/backend `
	--secret-string '{"JWT_SECRET":"replace-me","DATABASE_URL":"replace-me"}' `
	--region ap-south-1
```

If the secret already exists, update it:

```powershell
aws secretsmanager put-secret-value `
	--secret-id cab-company/dev/backend `
	--secret-string '{"JWT_SECRET":"replace-me","DATABASE_URL":"replace-me"}' `
	--region ap-south-1
```

Then set `backend_secrets_manager_secret_arn` in `terraform/terraform.tfvars` to the secret ARN and run Terraform apply.

## 6) Deploy backend with Helm (automatic IRSA role injection)

Use the Helm deploy helper script. It reads `backend_irsa_role_arn` from Terraform output and injects it into Helm values at deploy time.

```powershell
cd ../../kubernetes
./deploy-backend-helm.ps1 -WaitRollout
```

If you prefer Kustomize/manual apply, replace `REPLACE_WITH_BACKEND_IRSA_ROLE_ARN` in `backend-serviceaccount.yaml` and run `kubectl apply -k .`.

Helm chart path: `kubernetes/helm/cab-backend`

## 7) Verify rollout

```powershell
kubectl get deployments -n cab-company
kubectl get pods -n cab-company
kubectl get svc -n cab-company
kubectl get nodes
helm list -n cab-company
```

Backend pods now load `APP_SECRETS_MANAGER_SECRET_ID` at startup and map every key from the secret JSON into process environment variables.

## 8) Get frontend public URL

```powershell
cd ../terraform
terraform output frontend_website_endpoint
```

The frontend is served from S3, so you do not need a frontend LoadBalancer service in Kubernetes.
