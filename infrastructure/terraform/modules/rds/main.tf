# RDS PostgreSQL Module for MapVibe
# Creates RDS instance with PostGIS support
# NOTE: Publicly accessible for MVP - Lambda connects via internet

# Security Group for RDS
resource "aws_security_group" "rds" {
  name        = "mapvibe-rds-sg-${var.environment}"
  description = "Security group for MapVibe RDS"
  vpc_id      = var.vpc_id

  # Allow public access for Lambda (outside VPC) and development tools
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "PostgreSQL public access (MVP)"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "mapvibe-rds-sg-${var.environment}"
  }
}

# DB Subnet Group (public subnets for MVP)
resource "aws_db_subnet_group" "main" {
  name       = "mapvibe-db-subnet-${var.environment}"
  subnet_ids = var.public_subnet_ids

  tags = {
    Name = "mapvibe-db-subnet-${var.environment}"
  }
}

# RDS Parameter Group (for PostgreSQL extensions)
resource "aws_db_parameter_group" "postgres" {
  name   = "mapvibe-postgres-params-${var.environment}"
  family = "postgres15"

  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements"
    apply_method = "pending-reboot" # Requires DB restart to take effect
  }

  parameter {
    name         = "log_statement"
    value        = "all"
    apply_method = "immediate" # Can apply without restart
  }

  tags = {
    Name = "mapvibe-postgres-params-${var.environment}"
  }
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier = "mapvibe-db-${var.environment}"

  # Engine
  engine               = "postgres"
  engine_version       = "15.10"
  instance_class       = var.instance_class
  parameter_group_name = aws_db_parameter_group.postgres.name

  # Storage
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.allocated_storage * 4 # Auto-scaling up to 4x
  storage_type          = "gp3"
  storage_encrypted     = true

  # Database
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  # Network (public for MVP)
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = true
  multi_az               = var.multi_az

  # Backup
  backup_retention_period = var.environment == "prod" ? 7 : 1
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Monitoring
  enabled_cloudwatch_logs_exports = ["postgresql"]
  performance_insights_enabled    = var.instance_class != "db.t3.micro" # Not supported on t3.micro

  # Other
  skip_final_snapshot       = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "mapvibe-final-snapshot-${var.environment}" : null
  deletion_protection       = var.environment == "prod"

  tags = {
    Name = "mapvibe-db-${var.environment}"
  }
}


