locals {
  name = "youmin-${var.environment}"
  tags = merge(var.tags, { Environment = var.environment })
}

resource "alicloud_vpc" "main" {
  vpc_name   = "${local.name}-vpc"
  cidr_block = "10.40.0.0/16"
  tags       = local.tags
}

resource "alicloud_vswitch" "primary" {
  vpc_id       = alicloud_vpc.main.id
  zone_id      = var.primary_zone_id
  cidr_block   = "10.40.1.0/24"
  vswitch_name = "${local.name}-primary"
  tags         = local.tags
}

resource "alicloud_vswitch" "secondary" {
  vpc_id       = alicloud_vpc.main.id
  zone_id      = var.secondary_zone_id
  cidr_block   = "10.40.2.0/24"
  vswitch_name = "${local.name}-secondary"
  tags         = local.tags
}

resource "alicloud_security_group" "app" {
  vpc_id              = alicloud_vpc.main.id
  security_group_name = "${local.name}-app"
  inner_access_policy = "Accept"
  tags                = local.tags
}

resource "alicloud_cr_ee_instance" "app" {
  count              = var.create_acr_ee ? 1 : 0
  payment_type       = "Subscription"
  period             = 1
  renew_period       = 1
  renewal_status     = "ManualRenewal"
  instance_type      = "Basic"
  instance_name      = "${local.name}-acr"
  default_oss_bucket = true
  image_scanner      = "ACR"
}

resource "alicloud_cr_ee_namespace" "app" {
  count              = var.create_acr_ee ? 1 : 0
  instance_id        = alicloud_cr_ee_instance.app[0].id
  name               = "youmin"
  auto_create        = false
  default_visibility = "PRIVATE"
}

resource "alicloud_cr_ee_repo" "web" {
  count       = var.create_acr_ee ? 1 : 0
  instance_id = alicloud_cr_ee_instance.app[0].id
  namespace   = alicloud_cr_ee_namespace.app[0].name
  name        = "web"
  repo_type   = "PRIVATE"
  summary     = "Youmin OPC web application"
  detail      = "Immutable production images for the Youmin OPC community."
}

resource "alicloud_oss_bucket" "media" {
  bucket        = var.oss_bucket_name
  acl           = "private"
  storage_class = "Standard"
  versioning { status = "Enabled" }
  lifecycle_rule {
    id      = "abort-incomplete-multipart"
    prefix  = ""
    enabled = true
    abort_multipart_upload { days = 7 }
  }
  tags = local.tags
}

resource "alicloud_log_project" "app" {
  project_name = var.sls_project_name
  description  = "Youmin ${var.environment} application and security logs"
  tags         = local.tags
}

resource "alicloud_log_store" "application" {
  project_name     = alicloud_log_project.app.project_name
  logstore_name    = "application"
  retention_period = 90
  shard_count      = 2
  auto_split       = true
  max_split_shard_count = 16
}

resource "alicloud_db_instance" "postgres" {
  engine                   = "PostgreSQL"
  engine_version           = "16.0"
  category                 = "HighAvailability"
  instance_type            = var.rds_instance_type
  instance_storage         = 100
  db_instance_storage_type = "cloud_essd"
  instance_charge_type     = "Postpaid"
  instance_name            = "${local.name}-postgres"
  vswitch_id               = alicloud_vswitch.primary.id
  zone_id                  = var.primary_zone_id
  zone_id_slave_a          = var.secondary_zone_id
  security_ips             = [alicloud_vpc.main.cidr_block]
  ssl_action               = "Open"
  ha_config                = "Auto"
  pg_bouncer_enabled       = true
  deletion_protection      = var.environment == "production"
  tags                     = local.tags
}

resource "alicloud_db_account" "app" {
  db_instance_id   = alicloud_db_instance.postgres.id
  account_name     = "youmin_app"
  account_password = var.rds_password
  account_type     = "Normal"
}

resource "alicloud_db_database" "app" {
  instance_id   = alicloud_db_instance.postgres.id
  name          = "youmin"
  character_set = "UTF8,C,en_US.utf8"
}

resource "alicloud_kvstore_instance" "redis" {
  db_instance_name          = "${local.name}-tair"
  instance_class            = var.tair_instance_class
  instance_type             = "Redis"
  engine_version            = "7.0"
  payment_type              = "PostPaid"
  vpc_id                    = alicloud_vpc.main.id
  vswitch_id                = alicloud_vswitch.primary.id
  zone_id                   = var.primary_zone_id
  secondary_zone_id         = var.secondary_zone_id
  password                  = var.tair_password
  security_ips              = [alicloud_vpc.main.cidr_block]
  instance_release_protection = var.environment == "production"
  backup_period             = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
  backup_time               = "20:00Z-21:00Z"
  enable_backup_log         = 1
  tags                      = local.tags
}

resource "alicloud_sae_namespace" "app" {
  namespace_id              = "${var.region}:${local.name}"
  namespace_name            = local.name
  namespace_description     = "Youmin ${var.environment}"
  enable_micro_registration = false
}

resource "alicloud_sae_application" "web" {
  app_name                         = "${local.name}-web"
  app_description                  = "Youmin OPC community"
  namespace_id                    = alicloud_sae_namespace.app.id
  image_url                        = var.image_url
  package_type                     = "Image"
  programming_language             = "other"
  replicas                         = 2
  cpu                              = 1000
  memory                           = 2048
  vpc_id                           = alicloud_vpc.main.id
  vswitch_id                       = alicloud_vswitch.primary.id
  security_group_id                = alicloud_security_group.app.id
  timezone                         = "Asia/Shanghai"
  termination_grace_period_seconds = 30
  envs                             = var.app_environment_json
  sls_configs                      = jsonencode([{ projectName = alicloud_log_project.app.project_name, logstoreName = alicloud_log_store.application.logstore_name, logType = "stdout", logDir = "", logtailName = "" }])
  tags                             = local.tags
}

resource "alicloud_sae_application" "worker" {
  app_name                         = "${local.name}-worker"
  app_description                  = "Youmin outbox and notification worker"
  namespace_id                    = alicloud_sae_namespace.app.id
  image_url                        = var.worker_image_url
  package_type                     = "Image"
  programming_language             = "other"
  replicas                         = 1
  cpu                              = 500
  memory                           = 1024
  vpc_id                           = alicloud_vpc.main.id
  vswitch_id                       = alicloud_vswitch.primary.id
  security_group_id                = alicloud_security_group.app.id
  timezone                         = "Asia/Shanghai"
  termination_grace_period_seconds = 30
  envs                             = var.app_environment_json
  sls_configs                      = jsonencode([{ projectName = alicloud_log_project.app.project_name, logstoreName = alicloud_log_store.application.logstore_name, logType = "stdout", logDir = "", logtailName = "" }])
  tags                             = local.tags
}
