#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
terraform_source="$repository_root/infra/terraform"
terraform_binary="${TERRAFORM_BIN:-terraform}"
task_plan_dir="$(mktemp -d)"
trap 'rm -rf "$task_plan_dir"' EXIT

for config_path in "$terraform_source"/*.tf; do
  if [[ "$(basename "$config_path")" != "backend.tf" ]]; then
    cp "$config_path" "$task_plan_dir/"
  fi
done
cp "$terraform_source/.terraform.lock.hcl" "$task_plan_dir/"

export ALIBABA_CLOUD_ACCESS_KEY_ID="terraform-plan-only-access-key"
export ALIBABA_CLOUD_ACCESS_KEY_SECRET="terraform-plan-only-secret"
export TF_IN_AUTOMATION="true"

"$terraform_binary" -chdir="$task_plan_dir" init -backend=false -input=false

for target_environment in staging production; do
  fixture="$terraform_source/fixtures/ci-$target_environment.tfvars.json"
  plan_file="$task_plan_dir/$target_environment.tfplan"
  plan_log="$task_plan_dir/$target_environment.log"
  plan_json="$task_plan_dir/$target_environment.json"

  if ! "$terraform_binary" -chdir="$task_plan_dir" plan \
    -input=false \
    -refresh=false \
    -lock=false \
    -compact-warnings \
    -no-color \
    -var-file="$fixture" \
    -out="$plan_file" > "$plan_log"; then
    command cat "$plan_log"
    exit 1
  fi

  "$terraform_binary" -chdir="$task_plan_dir" show -json "$plan_file" > "$plan_json"
  jq -e '(.resource_changes | length) > 0 and all(.resource_changes[]; (.change.actions | index("delete")) == null)' "$plan_json" > /dev/null
  planned_resources="$(jq '.resource_changes | length' "$plan_json")"
  echo "$target_environment offline plan passed with $planned_resources resource changes and no delete action"
done
