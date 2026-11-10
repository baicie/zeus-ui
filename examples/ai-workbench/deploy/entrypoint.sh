#!/bin/sh
# Normalises ZEUS_BYOK_CONNECT_SRC into ZEUS_BYOK_CONNECT_SRC_SPACED before
# nginx renders its templates.
#
# The CSP directive is a space-separated list, so the template needs either
# nothing or " <sources>". Asking an operator to remember the leading space is
# a trap: forget it and the source list concatenates onto `'self'`, producing
# `'self'https://x` which the browser silently ignores — BYOK then fails with a
# CSP error that looks like a policy problem but is really a formatting one.
#
# Here the value is trimmed, internal whitespace is collapsed, and the result is
# either empty or prefixed with exactly one space.
set -eu

raw="${ZEUS_BYOK_CONNECT_SRC:-}"

# Collapse tabs and repeated spaces, strip leading/trailing whitespace.
normalised=$(printf '%s' "$raw" | tr '\t' ' ' | tr -s ' ' | sed 's/^ //; s/ $//')

# Reject anything that would break out of the directive.
case "$normalised" in
  *";"* | *","* | *"'"*)
    echo "zeus-workbench: ZEUS_BYOK_CONNECT_SRC may only contain CSP source expressions separated by spaces." >&2
    exit 1
    ;;
esac

if [ -z "$normalised" ]; then
  export ZEUS_BYOK_CONNECT_SRC_SPACED=""
else
  export ZEUS_BYOK_CONNECT_SRC_SPACED=" $normalised"
fi

exec /docker-entrypoint.sh "$@"
