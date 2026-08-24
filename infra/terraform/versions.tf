terraform {
  required_version = ">= 1.15.0, < 1.16.0"
  backend "http" {}
  required_providers {
    alicloud = {
      source  = "aliyun/alicloud"
      version = "~> 1.285.0"
    }
  }
}

provider "alicloud" {
  region = var.region
}
