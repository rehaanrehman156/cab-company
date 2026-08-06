variable "project_name" {
  description = "Project/application name"
  type        = string
  default     = "cab-company"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region where resources are created"
  type        = string
  default     = "ap-south-1"
}

variable "aws_profile" {
  description = "AWS CLI profile used by Terraform"
  type        = string
  default     = ""
}

variable "kubernetes_version" {
  description = "EKS Kubernetes version"
  type        = string
  default     = "1.31"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "cab-company-eks-auto"
}

variable "backend_service_account_namespace" {
  description = "Namespace for the backend Kubernetes service account"
  type        = string
  default     = "cab-company"
}

variable "backend_service_account_name" {
  description = "Name of the backend Kubernetes service account"
  type        = string
  default     = "cab-backend-sa"
}

variable "backend_secrets_manager_secret_arn" {
  description = "Secrets Manager secret ARN that backend pods can read at runtime"
  type        = string
  default     = ""
}

variable "eks_oidc_thumbprint" {
  description = "SHA1 thumbprint for the EKS OIDC root CA used by IAM OIDC provider"
  type        = string
  default     = "9e99a48a9960b14926bb7f3b02e22da0afd40d16"
}

variable "use_default_vpc" {
  description = "If true and subnet_ids is empty, Terraform picks subnets from the default VPC"
  type        = bool
  default     = true
}

variable "subnet_ids" {
  description = "Subnet IDs for EKS cluster (minimum 2, ideally across AZs)"
  type        = list(string)
  default     = []
}

variable "security_group_ids" {
  description = "Optional additional security groups for EKS cluster ENIs"
  type        = list(string)
  default     = []
}

variable "cluster_endpoint_public_access" {
  description = "Enable public endpoint for EKS API"
  type        = bool
  default     = true
}

variable "cluster_endpoint_private_access" {
  description = "Enable private endpoint for EKS API"
  type        = bool
  default     = true
}

variable "node_pools" {
  description = "Built-in EKS Auto Mode node pools"
  type        = list(string)
  default     = ["general-purpose", "system"]
}

variable "create_ecr_repositories" {
  description = "Create ECR repositories for backend and frontend images"
  type        = bool
  default     = true
}

variable "create_frontend_static_site" {
  description = "Create an S3 bucket for static frontend hosting"
  type        = bool
  default     = true
}

variable "frontend_bucket_name" {
  description = "Optional custom S3 bucket name for the frontend static site"
  type        = string
  default     = ""
}

variable "frontend_index_document" {
  description = "Default index document for the frontend static site"
  type        = string
  default     = "index.html"
}

variable "frontend_error_document" {
  description = "Error document for the frontend static site"
  type        = string
  default     = "index.html"
}

variable "create_mysql_database" {
  description = "Create an RDS MySQL instance for backend persistence"
  type        = bool
  default     = false
}

variable "mysql_instance_class" {
  description = "RDS instance class for MySQL"
  type        = string
  default     = "db.t3.micro"
}

variable "mysql_allocated_storage" {
  description = "Allocated storage (GiB) for MySQL"
  type        = number
  default     = 20
}

variable "mysql_db_name" {
  description = "Initial database name for MySQL"
  type        = string
  default     = "cab_company"
}

variable "mysql_master_username" {
  description = "Master username for MySQL"
  type        = string
  default     = "cabadmin"
}

variable "mysql_master_password" {
  description = "Master password for MySQL (set in terraform.tfvars when create_mysql_database is true)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "mysql_port" {
  description = "Port exposed by MySQL"
  type        = number
  default     = 3306
}

variable "mysql_allowed_cidr_blocks" {
  description = "CIDR blocks allowed to connect to MySQL. Empty means selected VPC CIDR only"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default = {
    Project     = "cab-company"
    ManagedBy   = "terraform"
    Environment = "dev"
  }
}
