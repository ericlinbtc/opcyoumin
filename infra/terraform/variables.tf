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

variable "release_sha" {
  type        = string
  description = "Full git SHA deployed by both immutable images"
  validation {
    condition     = can(regex("^[0-9a-f]{40}$", var.release_sha))
    error_message = "release_sha must contain 40 lowercase hexadecimal characters"
  }
}

variable "web_replicas" {
  type    = number
  default = 2
  validation {
    condition     = var.web_replicas >= 2
    error_message = "web_replicas must be at least 2"
  }
}

variable "oss_bucket_name" {
  type = string
}

variable "public_origins" {
  type        = list(string)
  description = "Exact HTTPS browser origins allowed by OSS CORS"
  validation {
    condition     = length(var.public_origins) > 0 && alltrue([for origin in var.public_origins : can(regex("^https://[^/]+$", origin))])
    error_message = "public_origins must contain at least one exact HTTPS origin without a path"
  }
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

variable "public_domain" {
  type        = string
  default     = ""
  description = "Production domain provisioned outside this base module"
}

variable "certificate_id" {
  type        = string
  default     = ""
  description = "Verified TLS certificate identifier"
}

variable "ingress_id" {
  type        = string
  default     = ""
  description = "ALB/SAE ingress identifier bound to the web application"
}

variable "waf_policy_id" {
  type        = string
  default     = ""
  description = "WAF policy protecting authentication, uploads and administration paths"
}

variable "cdn_domain" {
  type        = string
  default     = ""
  description = "CDN/DCDN accelerated domain"
}

variable "alarm_contact_group" {
  type        = string
  default     = ""
  description = "Cloud Monitor/SLS alarm contact group identifier"
}

variable "cost_alert_id" {
  type        = string
  default     = ""
  description = "Cost budget or threshold alert identifier"
}

variable "restore_drill_evidence" {
  type        = string
  default     = ""
  description = "Ticket or artifact URI proving the latest isolated RDS restore drill"
}

variable "oss_private_origin_configured" {
  type        = bool
  default     = false
  description = "True only after CDN private OSS origin authorization is verified"
}

variable "create_acr_ee" {
  type        = bool
  default     = false
  description = "Creates a billable ACR Enterprise Basic instance when true"
}

variable "tags" {
  type    = map(string)
  default = { Project = "youmin-opc", ManagedBy = "terraform" }
}
