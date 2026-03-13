#!/bin/bash
# Update Demo Environment — single command wrapper
# Usage: bash scripts/update-demo.sh [--dry-run]
exec npx tsx scripts/updateDemoEnvironment.ts "$@"
