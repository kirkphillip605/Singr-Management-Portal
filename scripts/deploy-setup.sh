#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Singr Karaoke Connect — Interactive Deployment Setup
# ─────────────────────────────────────────────────────────────────────────────
# Generates a .env file by walking through grouped configuration sections.
# Usage:
#   bash scripts/deploy-setup.sh
#   bash scripts/deploy-setup.sh --dry-run   (preview without writing)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

ENV_FILE=".env"
declare -A ENV_VARS

# ── Helpers ──
print_header() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  $1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_info() {
  echo -e "  ${DIM}$1${NC}"
}

prompt_value() {
  local var_name="$1"
  local description="$2"
  local default_value="${3:-}"
  local is_secret="${4:-false}"

  local prompt_text
  if [[ -n "$default_value" ]]; then
    prompt_text="  ${GREEN}${var_name}${NC} ${DIM}(${default_value})${NC}: "
  else
    prompt_text="  ${GREEN}${var_name}${NC}: "
  fi

  echo -e "  ${DIM}${description}${NC}"

  local input
  if [[ "$is_secret" == "true" ]]; then
    read -rsp "$(echo -e "$prompt_text")" input
    echo ""
  else
    read -rp "$(echo -e "$prompt_text")" input
  fi

  ENV_VARS["$var_name"]="${input:-$default_value}"
}

generate_secret() {
  openssl rand -base64 "$1" 2>/dev/null || head -c "$1" /dev/urandom | base64 | tr -d '\n'
}

validate_e164() {
  local phone="$1"
  if [[ "$phone" =~ ^\+[1-9][0-9]{6,14}$ ]]; then
    return 0
  fi
  return 1
}

# ── Section Navigation ──
SECTIONS=(environment database redis auth oauth twilio smtp stripe sentry ports misc)
CURRENT_SECTION=0
TOTAL_SECTIONS=${#SECTIONS[@]}

navigate_sections() {
  while [[ $CURRENT_SECTION -lt $TOTAL_SECTIONS ]]; do
    local section="${SECTIONS[$CURRENT_SECTION]}"
    "section_${section}"

    echo ""
    echo -e "  ${DIM}[Enter] Next section  |  [b] Go back  |  [q] Quit${NC}"
    read -rp "  > " nav_input

    case "$nav_input" in
      b|B)
        if [[ $CURRENT_SECTION -gt 0 ]]; then
          ((CURRENT_SECTION--))
        else
          echo -e "  ${YELLOW}Already at the first section.${NC}"
        fi
        ;;
      q|Q)
        echo -e "\n  ${YELLOW}Setup cancelled.${NC}"
        exit 0
        ;;
      *)
        ((CURRENT_SECTION++))
        ;;
    esac
  done
}

# ── Section Definitions ──

section_environment() {
  print_header "1/10 — Environment"
  echo ""
  echo -e "  Select the target environment:"
  echo -e "    ${GREEN}1)${NC} development"
  echo -e "    ${GREEN}2)${NC} staging"
  echo -e "    ${GREEN}3)${NC} production"
  echo ""
  read -rp "  Choice [1]: " env_choice
  case "${env_choice:-1}" in
    2) ENV_VARS[NODE_ENV]="staging" ;;
    3) ENV_VARS[NODE_ENV]="production" ;;
    *) ENV_VARS[NODE_ENV]="development" ;;
  esac
  echo -e "  → ${BOLD}${ENV_VARS[NODE_ENV]}${NC}"

  if [[ "${ENV_VARS[NODE_ENV]}" == "development" ]]; then
    ENV_VARS[LOG_LEVEL]="debug"
  else
    ENV_VARS[LOG_LEVEL]="info"
  fi
}

section_database() {
  print_header "2/10 — Database (PostgreSQL)"
  echo ""
  local db_password
  db_password=$(generate_secret 24)

  prompt_value "DB_PASSWORD" "Database password (auto-generated if empty)" "$db_password" true
  prompt_value "PORT_DB" "PostgreSQL port" "25432"

  local pw="${ENV_VARS[DB_PASSWORD]}"
  local port="${ENV_VARS[PORT_DB]}"
  ENV_VARS[DATABASE_URL]="postgresql://singr:${pw}@localhost:${port}/singr"
  echo -e "  → ${DIM}DATABASE_URL=${ENV_VARS[DATABASE_URL]}${NC}"
}

section_redis() {
  print_header "3/10 — Redis"
  echo ""
  prompt_value "PORT_REDIS" "Redis port" "26379"
  ENV_VARS[REDIS_URL]="redis://localhost:${ENV_VARS[PORT_REDIS]}"
  echo -e "  → ${DIM}REDIS_URL=${ENV_VARS[REDIS_URL]}${NC}"
}

section_auth() {
  print_header "4/10 — Better Auth"
  echo ""
  local auth_secret
  auth_secret=$(generate_secret 32)

  prompt_value "BETTER_AUTH_SECRET" "Session signing secret (auto-generated)" "$auth_secret" true
  prompt_value "BETTER_AUTH_URL" "Canonical auth base URL" "https://host.singrkaraoke.com"
}

section_oauth() {
  print_header "5/10 — OAuth Providers"
  echo ""
  print_info "Google OAuth — https://console.cloud.google.com/apis/credentials"
  prompt_value "GOOGLE_CLIENT_ID" "Google OAuth Client ID" ""
  prompt_value "GOOGLE_CLIENT_SECRET" "Google OAuth Client Secret" "" true

  echo ""
  print_info "Apple Sign-In — https://developer.apple.com/account/resources/identifiers"
  prompt_value "APPLE_CLIENT_ID" "Apple Services ID" ""
  prompt_value "APPLE_TEAM_ID" "Apple Developer Team ID" ""
  prompt_value "APPLE_KEY_ID" "Apple Sign-In Key ID" ""
  prompt_value "APPLE_PRIVATE_KEY" "Base64-encoded .p8 private key" "" true
}

section_twilio() {
  print_header "6/10 — Twilio (SMS / Phone OTP)"
  echo ""
  print_info "https://console.twilio.com"
  prompt_value "TWILIO_ACCOUNT_SID" "Twilio Account SID" ""
  prompt_value "TWILIO_AUTH_TOKEN" "Twilio Auth Token" "" true

  local phone_valid=false
  while [[ "$phone_valid" == false ]]; do
    prompt_value "TWILIO_FROM_NUMBER" "Twilio phone number (E.164, e.g. +15551234567)" ""
    if [[ -z "${ENV_VARS[TWILIO_FROM_NUMBER]}" ]] || validate_e164 "${ENV_VARS[TWILIO_FROM_NUMBER]}"; then
      phone_valid=true
    else
      echo -e "  ${RED}Invalid E.164 format. Must be +[country code][number] (e.g. +15551234567)${NC}"
    fi
  done
}

section_smtp() {
  print_header "7/10 — SMTP (Email)"
  echo ""
  print_info "Used for password resets, magic links, email OTP, and notifications."
  prompt_value "SMTP_HOST" "SMTP server hostname (e.g. in-v3.mailjet.com)" ""
  prompt_value "SMTP_PORT" "SMTP port" "587"
  prompt_value "SMTP_USER" "SMTP username" ""
  prompt_value "SMTP_PASS" "SMTP password" "" true
  prompt_value "SMTP_FROM" "From address" "no-reply@singrkaraoke.com"
}

section_stripe() {
  print_header "8/10 — Stripe (Billing)"
  echo ""
  print_info "https://dashboard.stripe.com/apikeys"
  prompt_value "STRIPE_SECRET_KEY" "Stripe Secret Key (sk_...)" "" true
  prompt_value "STRIPE_PUBLISHABLE_KEY" "Stripe Publishable Key (pk_...)" ""
  ENV_VARS[NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY]="${ENV_VARS[STRIPE_PUBLISHABLE_KEY]}"
  prompt_value "STRIPE_WEBHOOK_SECRET" "Webhook signing secret (whsec_...)" "" true
}

section_sentry() {
  print_header "9/10 — Sentry (Error Monitoring)"
  echo ""
  print_info "Each app gets its own Sentry project DSN."
  prompt_value "SENTRY_AUTH_TOKEN" "Sentry Auth Token (for sourcemap upload)" "" true
  prompt_value "SENTRY_ORG" "Sentry Organization slug" ""
  prompt_value "SENTRY_HOST_PORTAL_DSN" "Host Portal DSN" ""
  prompt_value "SENTRY_ADMIN_CONSOLE_DSN" "Admin Console DSN" ""
  prompt_value "SENTRY_API_DSN" "API DSN" ""
  prompt_value "SENTRY_SINGER_APP_DSN" "Singer App DSN" ""
}

section_ports() {
  print_header "10/10 — Service Ports & Miscellaneous"
  echo ""
  print_info "Configure ports to avoid conflicts with other services."
  prompt_value "PORT_MARKETING" "Marketing site port" "25000"
  prompt_value "PORT_HOST_PORTAL" "Host Portal port" "25001"
  prompt_value "PORT_ADMIN_CONSOLE" "Admin Console port" "25002"
  prompt_value "PORT_API" "API port" "25003"
  prompt_value "PORT_SINGER_APP" "Singer App port" "25004"
  echo ""
  prompt_value "HERE_API_KEY" "HERE Maps API Key (venue geolocation)" ""
  prompt_value "API_RATE_LIMIT_MAX" "API rate limit (requests per window)" "1000"
  prompt_value "API_RATE_LIMIT_WINDOW" "Rate limit window (ms)" "3600000"
}

section_misc() {
  # This is actually the super admin creation step
  print_header "Super Admin Account (Optional)"
  echo ""
  echo -e "  ${DIM}Create an initial super admin account for the admin console.${NC}"
  echo -e "  ${DIM}Leave blank to skip.${NC}"
  echo ""
  prompt_value "ADMIN_FIRST_NAME" "First name" ""

  if [[ -n "${ENV_VARS[ADMIN_FIRST_NAME]}" ]]; then
    prompt_value "ADMIN_LAST_NAME" "Last name" ""
    prompt_value "ADMIN_EMAIL" "Email address" ""

    local phone_valid=false
    while [[ "$phone_valid" == false ]]; do
      prompt_value "ADMIN_PHONE" "Phone (E.164, e.g. +15551234567)" ""
      if [[ -z "${ENV_VARS[ADMIN_PHONE]}" ]] || validate_e164 "${ENV_VARS[ADMIN_PHONE]}"; then
        phone_valid=true
      else
        echo -e "  ${RED}Invalid E.164 format.${NC}"
      fi
    done

    prompt_value "ADMIN_PASSWORD" "Password (min 12 chars)" "" true
  fi
}

# ── Write .env ──
write_env_file() {
  local output=""

  output+="# ─────────────────────────────────────────────────────────────────────────────\n"
  output+="# Singr Karaoke Connect — Generated by deploy-setup.sh\n"
  output+="# Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')\n"
  output+="# Environment: ${ENV_VARS[NODE_ENV]}\n"
  output+="# ─────────────────────────────────────────────────────────────────────────────\n\n"

  # Write in order
  local ordered_vars=(
    "NODE_ENV" "LOG_LEVEL"
    "DATABASE_URL" "DB_PASSWORD" "PORT_DB"
    "REDIS_URL" "PORT_REDIS"
    "BETTER_AUTH_SECRET" "BETTER_AUTH_URL"
    "GOOGLE_CLIENT_ID" "GOOGLE_CLIENT_SECRET"
    "APPLE_CLIENT_ID" "APPLE_TEAM_ID" "APPLE_KEY_ID" "APPLE_PRIVATE_KEY"
    "TWILIO_ACCOUNT_SID" "TWILIO_AUTH_TOKEN" "TWILIO_FROM_NUMBER"
    "SMTP_HOST" "SMTP_PORT" "SMTP_USER" "SMTP_PASS" "SMTP_FROM"
    "STRIPE_SECRET_KEY" "STRIPE_PUBLISHABLE_KEY" "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" "STRIPE_WEBHOOK_SECRET"
    "SENTRY_AUTH_TOKEN" "SENTRY_ORG" "SENTRY_HOST_PORTAL_DSN" "SENTRY_ADMIN_CONSOLE_DSN" "SENTRY_API_DSN" "SENTRY_SINGER_APP_DSN"
    "PORT_MARKETING" "PORT_HOST_PORTAL" "PORT_ADMIN_CONSOLE" "PORT_API" "PORT_SINGER_APP"
    "HERE_API_KEY" "API_RATE_LIMIT_MAX" "API_RATE_LIMIT_WINDOW"
  )

  local prev_group=""
  for var in "${ordered_vars[@]}"; do
    # Group separators
    local group=""
    case "$var" in
      NODE_ENV|LOG_LEVEL) group="APP" ;;
      DATABASE_URL|DB_PASSWORD|PORT_DB) group="DATABASE" ;;
      REDIS_URL|PORT_REDIS) group="REDIS" ;;
      BETTER_AUTH_*) group="AUTH" ;;
      GOOGLE_*) group="GOOGLE" ;;
      APPLE_*) group="APPLE" ;;
      TWILIO_*) group="TWILIO" ;;
      SMTP_*) group="SMTP" ;;
      STRIPE_*|NEXT_PUBLIC_STRIPE_*) group="STRIPE" ;;
      SENTRY_*) group="SENTRY" ;;
      PORT_*) group="PORTS" ;;
      HERE_*|API_RATE_*) group="MISC" ;;
    esac

    if [[ "$group" != "$prev_group" ]]; then
      output+="\n# ── ${group} ──\n"
      prev_group="$group"
    fi

    local val="${ENV_VARS[$var]:-}"
    output+="${var}=\"${val}\"\n"
  done

  if [[ "$DRY_RUN" == true ]]; then
    echo ""
    print_header "DRY RUN — .env preview"
    echo -e "$output"
  else
    echo -e "$output" > "$ENV_FILE"
    echo ""
    echo -e "  ${GREEN}✓${NC} ${BOLD}.env file written successfully${NC}"
    echo -e "  ${DIM}Path: $(pwd)/${ENV_FILE}${NC}"
  fi
}

# ── Main ──
main() {
  echo ""
  echo -e "${BOLD}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║           Singr Karaoke Connect — Setup Wizard              ║${NC}"
  echo -e "${BOLD}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${DIM}This wizard will help you generate a .env file for your deployment.${NC}"
  echo -e "  ${DIM}You can navigate between sections using [Enter], [b]ack, or [q]uit.${NC}"

  if [[ -f "$ENV_FILE" ]]; then
    echo ""
    echo -e "  ${YELLOW}⚠  An existing .env file was found.${NC}"
    read -rp "  Overwrite? [y/N]: " overwrite
    if [[ "${overwrite,,}" != "y" ]]; then
      echo -e "  ${DIM}Setup cancelled.${NC}"
      exit 0
    fi
  fi

  navigate_sections
  write_env_file

  # Offer to start services
  if [[ "$DRY_RUN" == false ]]; then
    echo ""
    read -rp "  Start services with docker compose? [y/N]: " start_services
    if [[ "${start_services,,}" == "y" ]]; then
      echo -e "  ${CYAN}Starting services...${NC}"
      docker compose up -d
      echo -e "  ${GREEN}✓${NC} Services started."
      echo ""
      echo -e "  ${DIM}Run 'docker compose logs -f' to tail logs.${NC}"
    fi
  fi

  echo ""
  echo -e "  ${GREEN}${BOLD}Setup complete!${NC}"
  echo -e "  ${DIM}See DEPLOYMENT.md for next steps.${NC}"
  echo ""
}

main
