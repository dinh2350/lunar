#!/usr/bin/env bash
# goto-day.sh — Navigate to any day's code snapshot
#
# Usage:
#   ./goto-day.sh 9        Jump to Day 9
#   ./goto-day.sh 9 diff   Show what changed on Day 9
#   ./goto-day.sh list      List all days
#   ./goto-day.sh current   Show which day you're on
#   ./goto-day.sh back      Return to main branch

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

usage() {
  echo -e "${BOLD}🌙 Lunar — Day Navigator${NC}"
  echo ""
  echo -e "  ${CYAN}./goto-day.sh <number>${NC}       Jump to a day's code"
  echo -e "  ${CYAN}./goto-day.sh <number> diff${NC}  See what changed that day"
  echo -e "  ${CYAN}./goto-day.sh list${NC}           List all 100 days"
  echo -e "  ${CYAN}./goto-day.sh current${NC}        Show which day you're on"
  echo -e "  ${CYAN}./goto-day.sh back${NC}           Return to main branch"
  echo ""
  echo -e "  ${YELLOW}Examples:${NC}"
  echo "    ./goto-day.sh 1        # Start from the beginning"
  echo "    ./goto-day.sh 9 diff   # See Day 9's changes"
  echo "    ./goto-day.sh back     # Go back to latest code"
}

list_days() {
  echo -e "${BOLD}🌙 Lunar — 100-Day Learning Path${NC}\n"

  echo -e "${CYAN}Phase 1: Foundation (Days 1-20)${NC}"
  for i in $(seq 1 20); do
    tag="day-$i"
    msg=$(git tag -l "$tag" --format='%(objectname:short)' | head -1)
    desc=$(git log -1 --format='%s' "$tag" 2>/dev/null | sed 's/^[^:]*: //')
    printf "  ${GREEN}day-%-3s${NC} %s\n" "$i" "$desc"
  done

  echo -e "\n${CYAN}Phase 2: Intelligence (Days 21-40)${NC}"
  for i in $(seq 21 40); do
    desc=$(git log -1 --format='%s' "day-$i" 2>/dev/null | sed 's/^[^:]*: //')
    printf "  ${GREEN}day-%-3s${NC} %s\n" "$i" "$desc"
  done

  echo -e "\n${CYAN}Phase 3: Scale (Days 41-70)${NC}"
  for i in $(seq 41 70); do
    desc=$(git log -1 --format='%s' "day-$i" 2>/dev/null | sed 's/^[^:]*: //')
    printf "  ${GREEN}day-%-3s${NC} %s\n" "$i" "$desc"
  done

  echo -e "\n${CYAN}Phase 4: Launch (Days 71-100)${NC}"
  for i in $(seq 71 100); do
    desc=$(git log -1 --format='%s' "day-$i" 2>/dev/null | sed 's/^[^:]*: //')
    printf "  ${GREEN}day-%-3s${NC} %s\n" "$i" "$desc"
  done
}

show_current() {
  current=$(git describe --tags --exact-match 2>/dev/null || echo "")
  if [[ -z "$current" ]]; then
    branch=$(git branch --show-current 2>/dev/null || echo "detached")
    if [[ "$branch" == "main" ]]; then
      echo -e "You're on ${GREEN}main${NC} (Day 100 — latest code)"
    else
      echo -e "You're on ${YELLOW}$branch${NC} (not on a specific day tag)"
    fi
  else
    echo -e "You're on ${GREEN}$current${NC}"
    git log -1 --format="  %s" "$current"
  fi
}

goto_day() {
  local day=$1
  local tag="day-$day"

  if ! git tag -l "$tag" | grep -q "$tag"; then
    echo -e "${RED}Error: Tag '$tag' not found.${NC} Valid range: day-1 to day-100"
    exit 1
  fi

  echo -e "📅 Jumping to ${GREEN}$tag${NC}..."
  git checkout "$tag" --quiet
  echo -e "${GREEN}✓${NC} Now at Day $day"
  git log -1 --format="  %s"
  echo ""
  echo -e "  ${YELLOW}Tip:${NC} Run ${CYAN}./goto-day.sh back${NC} to return to main"
}

show_diff() {
  local day=$1
  local tag="day-$day"

  if ! git tag -l "$tag" | grep -q "$tag"; then
    echo -e "${RED}Error: Tag '$tag' not found.${NC}"
    exit 1
  fi

  echo -e "📅 ${BOLD}Day $day — Changes${NC}\n"
  git log -1 --format="%s%n" "$tag"
  echo -e "${CYAN}Files changed:${NC}"
  git diff --stat "$tag~1" "$tag" 2>/dev/null || git show --stat --format="" "$tag"
  echo ""
  echo -e "${CYAN}Full diff:${NC}"
  git diff "$tag~1" "$tag" 2>/dev/null || git show --format="" "$tag"
}

# --- Main ---
if [[ $# -eq 0 ]]; then
  usage
  exit 0
fi

case "$1" in
  list)
    list_days
    ;;
  current)
    show_current
    ;;
  back|main|return)
    echo -e "Returning to ${GREEN}main${NC}..."
    git checkout main --quiet
    echo -e "${GREEN}✓${NC} Back on main branch (Day 100 — latest)"
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    if [[ "$1" =~ ^[0-9]+$ ]]; then
      if [[ $# -ge 2 && "$2" == "diff" ]]; then
        show_diff "$1"
      else
        goto_day "$1"
      fi
    else
      echo -e "${RED}Error: Invalid argument '$1'${NC}"
      usage
      exit 1
    fi
    ;;
esac
