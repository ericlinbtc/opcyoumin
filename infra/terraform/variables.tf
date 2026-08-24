variable "environment" {
  type = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production"
  }
}

variable "region" {
  type    = string
  default = "cn-hangzhou"
}

variable "primary_zone_id" {
  type = string
}

variable "secondary_zone_id" {
  type = string
}

variable "image_url" {
  type        = string
  description = "Immutable ACR image URL tagged by git SHA"
}

variable "worker_image_url" {
  type        = string
  description = "Immutable ACR worker image URL tagged by git SHA"
}

variable "oss_bucket_name" {
  type = string
}

variable "sls_project_name" {
  type = string
}

variable "rds_instance_type" {
  type = string
}

variable "tair_instance_class" {
  type = string
}

variable "rds_password" {
  type      = string
  sensitive = true
}

variable "tair_password" {
  type      = string
  sensitive = true
}

variable "app_environment_json" {
  type        = string
  sensitive   = true
  description = "SAE environment JSON sourced from a secret manager, never committed"
}

variable "create_acr_ee" {
  type        = bool
  default     = false
  description = "Creates a billable ACR Enterprise Basic instance when true"
}

variable "tags" {
  type = map(string)
  default = { Project = "youmin-opc", ManagedBy = "terraform" }
}
