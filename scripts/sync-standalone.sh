#!/usr/bin/env bash
# Mirrors mods/agent-flow from the fork to the standalone repository
# Charlie0113-T/claude-agent-flow: refreshes the vendored type declarations
# from mods/types when they changed (committing that), then pushes this
# folder's history with git subtree. Run from anywhere inside the fork.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
mod="$(cd "$here/.." && pwd)"
root="$(git -C "$mod" rev-parse --show-toplevel)"
prefix="${mod#"$root"/}"
remote="${AGENT_FLOW_STANDALONE_REMOTE:-standalone}"
url="${AGENT_FLOW_STANDALONE_URL:-https://github.com/Charlie0113-T/claude-agent-flow.git}"

cd "$root"

if [ -f mods/types/claude-code.d.ts ] && ! cmp -s mods/types/claude-code.d.ts "$prefix/vendor/claude-code.d.ts"; then
  cp mods/types/claude-code.d.ts "$prefix/vendor/claude-code.d.ts"
  git add "$prefix/vendor/claude-code.d.ts"
  git commit -q -m "agent-flow: refresh the vendored engine declarations" -- "$prefix/vendor/claude-code.d.ts"
  echo "vendored declarations refreshed and committed"
fi

if ! git remote get-url "$remote" >/dev/null 2>&1; then
  git remote add "$remote" "$url"
fi

git subtree push --prefix="$prefix" "$remote" main
