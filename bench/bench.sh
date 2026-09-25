#!/usr/bin/env bash
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.


# bench/bench.sh — lightweight performance benchmark harness for Texera.
#
# Purpose: capture repeatable performance numbers on a branch so any change
# (columnarization, engine work, frontend) can be compared against a stored
# baseline. Runnable headlessly (by humans or agents) from a git worktree.
#
# Usage:
#   bench/bench.sh warmup <scope>
#   bench/bench.sh run    <scope>     # scope: core | frontend | all
#   bench/bench.sh compare [file]     # vs bench/baseline.json (default: latest result)
#   bench/bench.sh baseline [file]    # promote a result (+git-add it) as the baseline
#
# Metrics collected (JSON, no colors):
#   scala:    sbt total time per module, scalatest run duration, and
#             per-test durations parsed from `testOnly -- -oD` output
#   frontend: wall time of `yarn build` (or first stage available)
#
# Contract (v1):
# - `warmup core` runs sbt Test/compile once per module (untimed) so compile
#   caches (~/.cache/sbt, shared across worktrees) are hot and not timed.
# - `run frontend` requires node_modules to already exist in the worktree
#   (`yarn install` at least once). No dependency install inside timed runs.
# - Results are stored under bench/results/<stamp>-<sha>-<scope>.json and are
#   gitignored; bench/baseline.json is meant to be committed after promotion.
# - One scope run at a time (sbt/YARN singletons, ports, machine load).
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
BENCH_DIR="$REPO/bench"
RESULTS_DIR="$BENCH_DIR/results"
LOG_DIR="$BENCH_DIR/logs"
BASELINE="$BENCH_DIR/baseline.json"
mkdir -p "$RESULTS_DIR" "$LOG_DIR"

# stable, cheap, pure-JVM modules (key:sbt-project:cwd-relative)
CORE_MODULES=(
  "workflow-core:WorkflowCore:common/workflow-core"
  "workflow-operator:WorkflowOperator:common/workflow-operator"
  "workflow-compiler:WorkflowCompiler:common/workflow-compiler"
  "dao:DAO:common/dao"
)

die() { echo "bench: $*" >&2; exit 1; }
now_ms() { date +%s%3N; }
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
GIT_SHA="$(git -C "$REPO" rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"
DIRTY="$(git -C "$REPO" status --porcelain | wc -l | tr -d ' ')"
# wrap commands with direnv when this shell is not already inside devenv
if command -v direnv >/dev/null && [ -z "${DIRENV_DIR:-}" ]; then
  sbt_cmd() { direnv exec "$REPO" sbt "$@"; }
  yarn_cmd() { direnv exec "$REPO" yarn "$@"; }
else
  sbt_cmd() { sbt "$@"; }
  yarn_cmd() { yarn "$@"; }
fi
run_timed() { # run_timed <log-file> <cmd...> → seconds (3 decimals)
  local log="$1"; shift
  local t0 t1
  t0="$(now_ms)"
  "$@" >"$log" 2>&1 || { tail -30 "$log" >&2; die "command failed (see $log)"; }
  t1="$(now_ms)"
  awk -v m=$((t1 - t0)) 'BEGIN { printf "%.3f", m / 1000 }'
}

# ── sbt metrics ──────────────────────────────────────────────────────────────
sbt_total_secs() {  # "[success] Total time: N s," → seconds (3 decimals)
  awk '/Total time:/{gsub(/\033\[[0-9;]*m/, ""); t=$4} END{printf "%.3f", t+0}' "$1"
}
scalatest_run_ms() {  # scalatest "Run completed in 1 minute, 48 seconds." → ms
  python3 - "$1" <<'PY'
import re, sys
best = ""
for line in open(sys.argv[1]):
    if "Run completed in" in line:
        best = line
        break
m = re.search(r"Run completed in ([^.]+\.?)", best)
if not m:
    print(0); raise SystemExit
total, unit_ms = 0.0, {"minute": 60000, "min": 60000, "second": 1000, "millisecond": 1, "ms": 1}
for comp in m.group(1).rstrip(".").split(","):
    comp = comp.strip()
    mm = re.match(r"([\d.]+) (\w+)", comp)
    if not mm: continue
    val, unit = float(mm.group(1)), mm.group(2).lower()
    total += val * next((v for k, v in unit_ms.items() if unit.startswith(k)), 1)
print(round(total))
PY
}
scalatest_counts() {  # tests suites failed — from scalatest summary lines
  awk '
    /Total number of tests run/{tests=$7}
    /Suites: completed/{suites=$4}
    /Tests: succeeded/{failed=$6}
    END{print tests+0, suites+0, failed+0}' "$1"
}
# per-test:  "[info] - name (1.5 seconds)" / "(2 milliseconds)"
scalatest_tests() { # write "ms|testname" lines to stdout
  sed 's/\x1b\[[0-9;]*m//g' "$1" | awk '
    /[[:space:]]- / && /\([0-9.]+ (milliseconds?|ms|seconds?)\)$/ {
      line=$0
      sub(/^[^ ]*[[:space:]]-[[:space:]]/, "", line)          # drop "[info] - "
      d=line; sub(/^.*\(/, "", d); sub(/\)[^)]*$/, "", d)     # e.g. "1.5 seconds"
      split(d, parts, " "); ms=parts[1]+0
      if (parts[2] ~ /^s/) ms = ms * 1000
      name=line; sub(/[[:space:]]*\(.*$/, "", name)
      gsub(/[[:space:]]+/, " ", name)
      print ms "|" name
    }'
}

bench_module() { # bench_module <key> <sbt-proj> <rel-dir>
  local key="$1" proj="$2" rel="$3"
  echo "== bench: $key ($proj) ==" >&2
  local log="$LOG_DIR/$STAMP-$key.log"
  local wall
  wall="$(run_timed "$log" sbt_cmd "$proj/testOnly -- -oD")"
  if ! grep -q "Run completed in" "$log"; then
    echo "  (no ScalaTest output — skipped/non-test module?)" >&2
    return 0
  fi
  local total
  total="$(sbt_total_secs "$log")"
  # scalatest run duration in ms
  local runms
  runms="$(scalatest_run_ms "$log")"
  local tests suites failed
  read -r tests suites failed < <(scalatest_counts "$log")
  # write per-test durations to a sidecar file
  # write per-test durations to a sidecar file
  local testsfile="$LOG_DIR/$STAMP-$key-tests.txt"
  scalatest_tests "$log" >"$testsfile"
  local ntests
  ntests=$(wc -l <"$testsfile" | tr -d ' ')
  MODULE_JSON="$key|$proj|$rel|$wall|$total|$runms|$tests|$suites|$failed|$ntests|$testsfile"
  python3 - "$MODULE_JSON" <<'PY'
import json, sys
key, proj, rel, wall, total, run_ms, tests, suites, failed, listed, testsfile = sys.argv[1].split("|")
print(json.dumps({
    "module": key, "sbt_project": proj, "dir": rel,
    "wall_s": float(wall), "sbt_total_s": float(total),
    "scalatest_run_ms": float(run_ms),
    "tests_run": int(tests), "suites": int(suites), "failed": int(failed),
    "per_test_lines": int(listed),
    "per_test_file": testsfile,
}))
PY
}

bench_jvm() {
  local out="$1"
  local fragments=()
  for spec in "${CORE_MODULES[@]}"; do
    IFS=':' read -r key proj rel <<<"$spec"
    local j
    j="$(bench_module "$key" "$proj" "$rel" "$out")" || { echo "module $key failed" >&2; continue; }
    printf '%s\n' "$j" >"$out.frags.$key.tmp"
    fragments+=("$out.frags.$key.tmp")
  done
  python3 - "$out" "${fragments[@]}" <<'PY'
import json, sys
out, frag_files = sys.argv[1], sys.argv[2:]
modules = [json.load(open(f)) for f in frag_files]
import os
for f in frag_files: os.remove(f)
result = {
    "meta": {"git_sha": os.environ.get("BENCH_SHA", ""), "kind": "jvm-modules",
             "machinetime": os.environ.get("BENCH_STAMP", "")},
    "modules": modules,
}
json.dump(result, open(out, "w"), indent=1)
PY
}

warmup_jvm() {
  for spec in "${CORE_MODULES[@]}"; do
    IFS=':' read -r key proj rel <<<"$spec"
    echo "== warmup: $proj (Test/compile) =="
    sbt_cmd "$proj/Test/compile"
  done
}

# ── frontend ────────────────────────────────────────────────────────────────
bench_frontend() {
  local out="$1"
  echo "== bench: frontend build ==" >&2
  [ -d "$REPO/frontend/node_modules" ] || die "frontend/node_modules missing — run 'yarn install' once first"
  local log="$LOG_DIR/$STAMP-frontend-build.log"
  local wall
  wall="$(run_timed "$log" bash -c "cd '$REPO/frontend' && $(command -v yarn) build")"
  local dist_kb
  dist_kb="$(du -sk "$REPO/frontend/dist" 2>/dev/null | awk '{print $1}' || echo 0)"
  python3 - "$out" "$wall" "$dist_kb" <<'PY'
import json, os, sys
out, wall, dist_kb = sys.argv[1], sys.argv[2], sys.argv[3]
json.dump({
    "meta": {"git_sha": os.environ.get("BENCH_SHA", ""), "kind": "frontend-build"},
    "build_wall_s": float(wall), "dist_kb": int(dist_kb),
}, open(out, "w"), indent=1)
PY
}

# ── actions ──────────────────────────────────────────────────────────────────
ACTION="${1:?usage: bench.sh warmup|run|baseline|compare <scope-or-file>}"
SCOPE="${2:-all}"
export BENCH_SHA="$GIT_SHA" BENCH_STAMP="$STAMP"
case "$ACTION" in
  warmup)
    case "$SCOPE" in
      core) warmup_jvm ;;
      frontend) die "frontend warmup: run 'yarn install' manually once per worktree" ;;
      all) warmup_jvm ;;
      *) die "unknown scope: $SCOPE" ;;
    esac
    ;;
  run)
    case "$SCOPE" in
      core|frontend|all) ;;
      *) die "unknown scope: $SCOPE" ;;
    esac
    run_scope() { # run_scope <scope>
      local file="$RESULTS_DIR/$STAMP-$GIT_SHA-$1.json"
      case "$1" in
        core) bench_jvm "$file" ;;
        frontend) bench_frontend "$file" ;;
      esac
      echo "results: $file"
    }
    if [ "$SCOPE" = all ]; then
      run_scope core
      run_scope frontend
    else
      run_scope "$SCOPE"
    fi
    ;;
  baseline)
    file="${2:-$(ls -1t "$RESULTS_DIR"/*.json | head -1)}"
    [ -f "$file" ] || die "no result file"
    cp "$file" "$BASELINE"
    echo "baseline set to: $(basename "$file") → $BASELINE"
    echo "(now git-add bench/baseline.json when you commit the harness)"
    ;;
  compare)
    file="${2:-$(ls -1t "$RESULTS_DIR"/*.json | head -1)}"
    [ -f "$file" ] || die "no result file(s) under bench/results/ yet"
    [ -f "$BASELINE" ] || die "no baseline yet — run 'bench.sh baseline <file>' first"
    python3 - "$BASELINE" "$file" <<'PY'
import json, sys
base, cur = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
if "modules" in base:
    rows = []
    for m in base["modules"]:
        c = next((x for x in cur.get("modules", []) if x["module"] == m["module"]), None)
        if not c: continue
        chg = (c["wall_s"] / m["wall_s"] - 1) * 100
        rows.append({"module": m["module"], "base_s": m["wall_s"], "cur_s": c["wall_s"],
                     "change_pct": round(chg, 2)})
    print(json.dumps(rows, indent=1))
else:
    chg = (cur["build_wall_s"] / base["build_wall_s"] - 1) * 100
    print(json.dumps([{"metric": "frontend build_wall_s",
                       "base_s": base["build_wall_s"], "cur_s": cur["build_wall_s"],
                       "change_pct": round(chg, 2)}], indent=1))
PY
    ;;
  *)
    die "unknown action: $ACTION"
    ;;
esac
