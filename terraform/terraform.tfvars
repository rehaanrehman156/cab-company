project_name       = "cab-company"
environment        = "dev"
aws_region         = "ap-south-1"
aws_profile        = ""
cluster_name       = "cab-company-eks-auto"
kubernetes_version = "1.31"

backend_service_account_namespace  = "cab-company"
backend_service_account_name       = "cab-backend-sa"
backend_secrets_manager_secret_arn = "PASTE_YOUR_SECRET_ARN_HERE"
eks_oidc_thumbprint = "9e99a48a9960b14926bb7f3b02e22da0afd40d16"

create_mysql_database     = true
mysql_instance_class      = "db.t3.micro"
mysql_allocated_storage   = 20
mysql_db_name             = "cab_company"
mysql_master_username     = "admin"
mysql_master_password     = "Alyaan123"
mysql_port                = 3306
mysql_allowed_cidr_blocks = []

use_default_vpc    = true
subnet_ids         = []
security_group_ids = []

cluster_endpoint_public_access  = true
cluster_endpoint_private_access = true

node_pools = ["general-purpose", "system"]

create_ecr_repositories     = true
create_frontend_static_site = true
frontend_bucket_name        = ""
frontend_index_document     = "index.html"
frontend_error_document     = "index.html"

tags = {
  Project     = "cab-company"
  Environment = "dev"
  ManagedBy   = "terraform"
}
