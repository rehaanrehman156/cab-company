# EKS Cluster Info

Last updated: 2026-08-01

## Cluster
- Name: cab-company-eks-auto
- Status: ACTIVE
- Region: ap-south-1
- Kubernetes version: 1.30
- ARN: arn:aws:eks:ap-south-1:328064416060:cluster/cab-company-eks-auto
- Endpoint: https://C855E36933817740D892DF40D75F834D.sk1.ap-south-1.eks.amazonaws.com
- Created at: 2026-07-31T23:31:36.242000+05:30

## Networking
- VPC ID: vpc-064c4b7c2267d22dc
- Subnets:
  - subnet-02e813449d81c9d0a
  - subnet-045498ed106fc8499
  - subnet-0cfbcd34f564a12a5
- Cluster security group: sg-004b058c31e2dd5b6

## IAM Roles
- Cluster role ARN: arn:aws:iam::328064416060:role/cab-company-dev-eks-cluster-role
- Node role ARN: arn:aws:iam::328064416060:role/cab-company-dev-eks-node-role

## ECR Repositories
- Backend: 328064416060.dkr.ecr.ap-south-1.amazonaws.com/cab-company-dev-backend
- Frontend: 328064416060.dkr.ecr.ap-south-1.amazonaws.com/cab-company-dev-frontend

## NodePools
- general-purpose: READY=True, NODES=0
- system: READY=True, NODES=0

## Notes
- Seeing NODES=0 is expected in EKS Auto Mode until workloads are scheduled.
- Terraform state is in the terraform folder; this file is a snapshot for quick reference.
