output "aws_account_id" {
  description = "AWS account id where resources are deployed"
  value       = data.aws_caller_identity.current.account_id
}

output "cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.this.name
}

output "cluster_arn" {
  description = "EKS cluster ARN"
  value       = aws_eks_cluster.this.arn
}

output "cluster_endpoint" {
  description = "EKS cluster API server endpoint"
  value       = aws_eks_cluster.this.endpoint
}

output "cluster_role_arn" {
  description = "IAM role ARN used by the EKS control plane"
  value       = aws_iam_role.eks_cluster_role.arn
}

output "node_role_arn" {
  description = "IAM role ARN used by EKS Auto Mode nodes"
  value       = aws_iam_role.eks_node_role.arn
}

output "selected_subnet_ids" {
  description = "Subnets passed to EKS cluster"
  value       = local.selected_subnet_ids
}

output "backend_ecr_repository_url" {
  description = "Backend ECR repository URL"
  value       = try(aws_ecr_repository.backend[0].repository_url, null)
}

output "frontend_ecr_repository_url" {
  description = "Frontend ECR repository URL"
  value       = try(aws_ecr_repository.frontend[0].repository_url, null)
}

output "frontend_bucket_name" {
  description = "S3 bucket name for the static frontend site"
  value       = try(aws_s3_bucket.frontend_site[0].bucket, null)
}

output "frontend_website_endpoint" {
  description = "S3 static website endpoint for the frontend"
  value       = try(aws_s3_bucket_website_configuration.frontend_site[0].website_endpoint, null)
}

output "backend_irsa_role_arn" {
  description = "IAM role ARN for backend service account runtime secret access"
  value       = try(aws_iam_role.backend_irsa_role[0].arn, null)
}

output "mysql_endpoint" {
  description = "RDS MySQL endpoint"
  value       = try(aws_db_instance.mysql[0].address, null)
}

output "mysql_port" {
  description = "RDS MySQL port"
  value       = try(aws_db_instance.mysql[0].port, null)
}

output "mysql_db_name" {
  description = "RDS MySQL initial database name"
  value       = try(aws_db_instance.mysql[0].db_name, null)
}

output "mysql_username" {
  description = "RDS MySQL master username"
  value       = var.create_mysql_database ? var.mysql_master_username : null
}

output "mysql_security_group_id" {
  description = "Security group attached to RDS MySQL"
  value       = try(aws_security_group.mysql[0].id, null)
}
