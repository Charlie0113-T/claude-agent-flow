#!/usr/bin/env bash
# Runs the interactive smoke test and judges its output. Costs real API
# calls (about half a dollar). usage: scripts/smoke.sh [out dir]
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
plugin="$(cd "$here/.." && pwd)"
out="${1:-/tmp/agent-flow-smoke}"
work="$(mktemp -d /tmp/agent-flow-work.XXXXXX)"

if [ -f "$here/local-env.sh" ]; then
  # shellcheck source=/dev/null
  source "$here/local-env.sh"
fi

mkdir -p "$out"
cp -R "$plugin/hooks" "$work/hooks"
rm -f "$out/smoke.raw" "$out/smoke-debug.txt"

expect "$here/smoke.exp" "$plugin" "$work" "$out" > "$out/expect.log" 2>&1 || true
grep '>>>' "$out/expect.log" || true

python3 - "$out/smoke.raw" "$out/smoke-debug.txt" <<'PY'
import re, sys

raw = open(sys.argv[1], 'rb').read().decode('utf-8', 'replace')
clean = re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07|\x1b[=>]|\r', '', raw)
debug = open(sys.argv[2], encoding='utf-8', errors='replace').read()
checks = {
    'pane header drawn': 'Agent flow ·' in clean,
    'a general-purpose node': re.search(r'└─ [●✓✗◐○] general-purpose', clean) is not None,
    'a nested Explore node': re.search(r'(   |│  )└─ [●✓✗◐○] Explore', clean) is not None,
    'a node finished': '✓' in clean,
    'module loaded': 'hooks module agent-flow loaded' in debug,
    'command ran': 'hooks module agent-flow command.run settled' in debug,
    'pane rendered': 'key=agent-flow' in debug,
    'no event-loop stall': '[event-loop-stall] blocked' not in debug,
    'no hook failure': re.search(r'agent-flow.*(threw|failed|error)', debug, re.I) is None,
}
ok = True
for name, passed in checks.items():
    print(('PASS ' if passed else 'FAIL ') + name)
    ok = ok and passed
sys.exit(0 if ok else 1)
PY
