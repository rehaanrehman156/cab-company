data "aws_caller_identity" "current" {}

data "aws_vpc" "default" {
  count   = var.use_default_vpc ? 1 : 0
  default = true
}

data "aws_subnets" "default_vpc_subnets" {
  count = var.use_default_vpc && length(var.subnet_ids) == 0 ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default[0].id]
  }
}

locals {
  name_prefix                 = "${var.project_name}-${var.environment}"
  selected_subnet_ids         = length(var.subnet_ids) > 0 ? var.subnet_ids : try(data.aws_subnets.default_vpc_subnets[0].ids, [])
  selected_security_group_ids = length(var.security_group_ids) > 0 ? var.security_group_ids : null
  frontend_bucket_name        = var.frontend_bucket_name != "" ? var.frontend_bucket_name : "${local.name_prefix}-frontend-site-${data.aws_caller_identity.current.account_id}"
  selected_vpc_id             = var.use_default_vpc ? data.aws_vpc.default[0].id : data.aws_subnet.selected[0].vpc_id

  cluster_role_policies = [
    "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
    "arn:aws:iam::aws:policy/AmazonEKSComputePolicy",
    "arn:aws:iam::aws:policy/AmazonEKSBlockStoragePolicyV2",
    "arn:aws:iam::aws:policy/AmazonEKSLoadBalancingPolicy",
    "arn:aws:iam::aws:policy/AmazonEKSNetworkingPolicy"
  ]

  node_role_policies = [
    "arn:aws:iam::aws:policy/AmazonEKSWorkerNodeMinimalPolicy",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPullOnly"
  ]

  mysql_allowed_cidrs = length(var.mysql_allowed_cidr_blocks) > 0 ? var.mysql_allowed_cidr_blocks : [data.aws_vpc.selected.cidr_block]
}

data "aws_subnet" "selected" {
  count = var.use_default_vpc ? 0 : 1
  id    = local.selected_subnet_ids[0]
}

data "aws_vpc" "selected" {
  id = local.selected_vpc_id
}

resource "aws_iam_role" "eks_cluster_role" {
  name = "${local.name_prefix}-eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
        Action = [
          "sts:AssumeRole",
          "sts:TagSession"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster_role_attachments" {
  for_each   = toset(local.cluster_role_policies)
  role       = aws_iam_role.eks_cluster_role.name
  policy_arn = each.value
}

resource "aws_iam_role" "eks_node_role" {
  name = "${local.name_prefix}-eks-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Action = ["sts:AssumeRole"]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "eks_node_role_attachments" {
  for_each   = toset(local.node_role_policies)
  role       = aws_iam_role.eks_node_role.name
  policy_arn = each.value
}

resource "aws_eks_cluster" "this" {
  name                          = var.cluster_name
  role_arn                      = aws_iam_role.eks_cluster_role.arn
  version                       = var.kubernetes_version
  bootstrap_self_managed_addons = false

  vpc_config {
    subnet_ids              = local.selected_subnet_ids
    security_group_ids      = local.selected_security_group_ids
    endpoint_public_access  = var.cluster_endpoint_public_access
    endpoint_private_access = var.cluster_endpoint_private_access
  }

  compute_config {
    enabled       = true
    node_role_arn = aws_iam_role.eks_node_role.arn
    node_pools    = var.node_pools
  }

  kubernetes_network_config {
    elastic_load_balancing {
      enabled = true
    }
  }

  storage_config {
    block_storage {
      enabled = true
    }
  }

  access_config {
    authentication_mode                         = "API"
    bootstrap_cluster_creator_admin_permissions = true
  }

  lifecycle {
    ignore_changes = [
      vpc_config[0].security_group_ids
    ]

    precondition {
      condition     = length(local.selected_subnet_ids) >= 2
      error_message = "Provide at least two subnet IDs, or enable use_default_vpc with a default VPC available."
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_role_attachments,
    aws_iam_role_policy_attachment.eks_node_role_attachments
  ]

  tags = merge(var.tags, {
    Name = var.cluster_name
  })
}

resource "aws_iam_openid_connect_provider" "eks" {
  url             = aws_eks_cluster.this.identity[0].oidc[0].issuer
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [var.eks_oidc_thumbprint]

  tags = var.tags
}

resource "aws_iam_role" "backend_irsa_role" {
  count = var.backend_secrets_manager_secret_arn != "" ? 1 : 0

  name = "${local.name_prefix}-backend-secrets-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.eks.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:aud" = "sts.amazonaws.com"
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub" = "system:serviceaccount:${var.backend_service_account_namespace}:${var.backend_service_account_name}"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "backend_secrets_access" {
  count = var.backend_secrets_manager_secret_arn != "" ? 1 : 0

  name = "${local.name_prefix}-backend-secrets-access"
  role = aws_iam_role.backend_irsa_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = var.backend_secrets_manager_secret_arn
      }
    ]
  })
}

resource "aws_ecr_repository" "backend" {
  count = var.create_ecr_repositories ? 1 : 0

  name                 = "${local.name_prefix}-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = var.tags
}

resource "aws_ecr_repository" "frontend" {
  count = var.create_ecr_repositories ? 1 : 0

  name                 = "${local.name_prefix}-frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = var.tags
}

resource "aws_s3_bucket" "frontend_site" {
  count = var.create_frontend_static_site ? 1 : 0

  bucket = local.frontend_bucket_name

  tags = merge(var.tags, {
    Name = local.frontend_bucket_name
  })
}

resource "aws_s3_bucket_ownership_controls" "frontend_site" {
  count = var.create_frontend_static_site ? 1 : 0

  bucket = aws_s3_bucket.frontend_site[0].id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "frontend_site" {
  count = var.create_frontend_static_site ? 1 : 0

  bucket = aws_s3_bucket.frontend_site[0].id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_website_configuration" "frontend_site" {
  count = var.create_frontend_static_site ? 1 : 0

  bucket = aws_s3_bucket.frontend_site[0].id

  index_document {
    suffix = var.frontend_index_document
  }

  error_document {
    key = var.frontend_error_document
  }
}

resource "aws_s3_bucket_policy" "frontend_site_public_read" {
  count = var.create_frontend_static_site ? 1 : 0

  bucket = aws_s3_bucket.frontend_site[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = ["s3:GetObject"]
        Resource  = ["${aws_s3_bucket.frontend_site[0].arn}/*"]
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.frontend_site]
}

resource "aws_db_subnet_group" "mysql" {
  count = var.create_mysql_database ? 1 : 0

  name       = "${local.name_prefix}-mysql-subnet-group"
  subnet_ids = local.selected_subnet_ids

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-mysql-subnet-group"
  })
}

resource "aws_security_group" "mysql" {
  count = var.create_mysql_database ? 1 : 0

  name        = "${local.name_prefix}-mysql-sg"
  description = "Allow MySQL inbound traffic for cab backend"
  vpc_id      = local.selected_vpc_id

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-mysql-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "mysql" {
  count = var.create_mysql_database ? length(local.mysql_allowed_cidrs) : 0

  security_group_id = aws_security_group.mysql[0].id
  cidr_ipv4         = local.mysql_allowed_cidrs[count.index]
  from_port         = var.mysql_port
  to_port           = var.mysql_port
  ip_protocol       = "tcp"
  description       = "MySQL access"
}

resource "aws_vpc_security_group_egress_rule" "mysql_all" {
  count = var.create_mysql_database ? 1 : 0

  security_group_id = aws_security_group.mysql[0].id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
  description       = "Allow all outbound traffic"
}

resource "aws_db_instance" "mysql" {
  count = var.create_mysql_database ? 1 : 0

  identifier             = "${local.name_prefix}-mysql"
  engine                 = "mysql"
  instance_class         = var.mysql_instance_class
  allocated_storage      = var.mysql_allocated_storage
  db_name                = var.mysql_db_name
  username               = var.mysql_master_username
  password               = var.mysql_master_password
  port                   = var.mysql_port
  db_subnet_group_name   = aws_db_subnet_group.mysql[0].name
  vpc_security_group_ids = [aws_security_group.mysql[0].id]

  publicly_accessible     = false
  multi_az                = false
  backup_retention_period = 0
  deletion_protection     = false
  skip_final_snapshot     = true
  apply_immediately       = true
  storage_type            = "gp3"

  lifecycle {
    precondition {
      condition     = var.mysql_master_password != ""
      error_message = "Set mysql_master_password in terraform.tfvars when create_mysql_database is true."
    }
  }

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-mysql"
  })
}
