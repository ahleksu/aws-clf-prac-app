#!/usr/bin/env bash
# Idempotently start, stop, restart, or inspect the EC2 backend instance.
# Defaults match the live classroom backend. Override with env vars if needed:
#   AWS_PROFILE=clf-quiz AWS_REGION=ap-southeast-1 INSTANCE_ID=i-... ./scripts/ec2-backend-lifecycle.sh status
set -euo pipefail

INSTANCE_ID="${INSTANCE_ID:-i-042b91a08364b6e01}"
AWS_REGION="${AWS_REGION:-ap-southeast-1}"
AWS_PROFILE="${AWS_PROFILE:-clf-quiz}"
API_URL="${API_URL:-https://api.47.130.41.30.nip.io}"
WAIT="${WAIT:-1}"
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-30}"
HEALTH_SLEEP_SECONDS="${HEALTH_SLEEP_SECONDS:-5}"

usage() {
  cat <<USAGE
Usage: $0 <status|start|stop|restart>

Actions are idempotent:
  status   Show EC2 state and backend health when reachable.
  start    Start the instance only if needed, wait for readiness, then check /health.
  stop     Stop the instance only if needed. This makes the live backend unavailable.
  restart  Stop then start the instance.

Environment overrides:
  INSTANCE_ID              Default: ${INSTANCE_ID}
  AWS_REGION               Default: ${AWS_REGION}
  AWS_PROFILE              Default: ${AWS_PROFILE}
  API_URL                  Default: ${API_URL}
  WAIT=0                   Skip AWS waiter calls.
  HEALTH_ATTEMPTS=30       Health-check retry count after start.
  HEALTH_SLEEP_SECONDS=5   Delay between health-check retries.

Note: stopping EC2 pauses compute, but attached storage/static IP costs may still apply.
USAGE
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

aws_ec2() {
  aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ec2 "$@"
}

instance_state() {
  aws_ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].State.Name' \
    --output text
}

instance_public_ip() {
  aws_ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text
}

wait_for() {
  local waiter="$1"
  local label="$2"
  if [[ "$WAIT" != "1" ]]; then
    echo "Skipping wait for ${label} because WAIT=${WAIT}."
    return
  fi
  echo "Waiting for ${label}..."
  aws_ec2 wait "$waiter" --instance-ids "$INSTANCE_ID"
}

check_health_once() {
  curl -fsS "${API_URL}/health"
}

wait_for_health() {
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl not found; skipping backend health check."
    return
  fi

  echo "Checking backend health at ${API_URL}/health..."
  for attempt in $(seq 1 "$HEALTH_ATTEMPTS"); do
    if result="$(check_health_once 2>/dev/null)"; then
      echo "Backend healthy: ${result}"
      return
    fi
    echo "Health check ${attempt}/${HEALTH_ATTEMPTS} failed; retrying in ${HEALTH_SLEEP_SECONDS}s..."
    sleep "$HEALTH_SLEEP_SECONDS"
  done

  echo "Backend did not become healthy after ${HEALTH_ATTEMPTS} attempts." >&2
  exit 1
}

show_status() {
  local state
  state="$(instance_state)"
  echo "Instance: ${INSTANCE_ID}"
  echo "Region:   ${AWS_REGION}"
  echo "Profile:  ${AWS_PROFILE}"
  echo "State:    ${state}"
  echo "Public IP: $(instance_public_ip)"

  if [[ "$state" == "running" ]] && command -v curl >/dev/null 2>&1; then
    if result="$(check_health_once 2>/dev/null)"; then
      echo "Health:   OK ${result}"
    else
      echo "Health:   unreachable at ${API_URL}/health"
    fi
  fi
}

start_instance() {
  local state
  state="$(instance_state)"
  case "$state" in
    running)
      echo "Instance is already running; no start needed."
      ;;
    pending)
      echo "Instance is already pending; waiting for running."
      ;;
    stopping)
      echo "Instance is stopping; waiting for stopped before starting."
      wait_for instance-stopped "instance to stop"
      aws_ec2 start-instances --instance-ids "$INSTANCE_ID" >/dev/null
      ;;
    stopped)
      echo "Starting instance ${INSTANCE_ID}..."
      aws_ec2 start-instances --instance-ids "$INSTANCE_ID" >/dev/null
      ;;
    *)
      echo "Cannot start instance from state: ${state}" >&2
      exit 1
      ;;
  esac

  wait_for instance-running "instance to run"
  wait_for instance-status-ok "EC2 status checks to pass"
  wait_for_health
  show_status
}

stop_instance() {
  local state
  state="$(instance_state)"
  case "$state" in
    stopped)
      echo "Instance is already stopped; no stop needed."
      ;;
    stopping)
      echo "Instance is already stopping."
      ;;
    pending)
      echo "Instance is pending; waiting for running before stopping."
      wait_for instance-running "instance to run"
      aws_ec2 stop-instances --instance-ids "$INSTANCE_ID" >/dev/null
      ;;
    running)
      echo "Stopping instance ${INSTANCE_ID}..."
      aws_ec2 stop-instances --instance-ids "$INSTANCE_ID" >/dev/null
      ;;
    *)
      echo "Cannot stop instance from state: ${state}" >&2
      exit 1
      ;;
  esac

  wait_for instance-stopped "instance to stop"
  show_status
}

main() {
  require_command aws
  local action="${1:-}"
  case "$action" in
    status)
      show_status
      ;;
    start)
      start_instance
      ;;
    stop)
      stop_instance
      ;;
    restart)
      stop_instance
      start_instance
      ;;
    -h|--help|help|"")
      usage
      ;;
    *)
      echo "Unknown action: ${action}" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
