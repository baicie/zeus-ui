#!/bin/sh
# Validates and normalises ZEUS_BYOK_CONNECT_SRC before nginx renders templates.
#
# The template puts this value inside `connect-src`, which is a page-wide
# capability: whatever is listed here, any script running on the page may send
# data to. A vault that is unlocked holds a provider key in memory, so a
# too-wide list turns a bug in the page into key exfiltration. The guard is
# therefore an allowlist of shapes, not a blocklist of characters.
#
# Accepted, per token, separated by whitespace:
#
#   https://host[:port]        the normal case
#   http://localhost[:port]    a local gateway (Ollama and friends)
#   http://127.0.0.1[:port]    the same, spelled as an address
#
# Rejected: wildcards (`*`), bare schemes (`https:`), any other scheme,
# credentials in the URL, paths, quotes, backslashes, `$`, CR/LF, `;`, `,`.
# Each of those either widens the policy to the whole network or breaks out of
# the directive.
set -eu

raw="${ZEUS_BYOK_CONNECT_SRC:-}"

# Collapse tabs and runs of spaces, strip the ends.
normalised=$(printf '%s' "$raw" | tr '\t' ' ' | tr -s ' ' | sed 's/^ //; s/ $//')

fail() {
  echo "zeus-workbench: ZEUS_BYOK_CONNECT_SRC $1" >&2
  echo "  got: ${raw}" >&2
  echo "  accepted forms: https://host[:port], http://localhost[:port], http://127.0.0.1[:port]" >&2
  exit 1
}

# A single token must match one of the accepted shapes.
is_valid_source() {
  case "$1" in
    # https origin, optional port, no path, no credentials, no wildcard.
    https://* | http://*)
      # Split off the scheme.
      rest=${1#*://}
      scheme=${1%%://*}
      # A path, query or fragment is not an origin.
      case "$rest" in
        */* | *\?* | *\#*) return 1 ;;
      esac
      # Credentials are not an origin either.
      case "$rest" in
        *@*) return 1 ;;
      esac
      # Split host and optional port.
      host=${rest%%:*}
      port=""
      case "$rest" in
        *:*) port=${rest#*:} ;;
      esac
      # Host must be non-empty and free of anything that is not a hostname
      # character. This rejects `*`, quotes, backslashes, `$` and control chars.
      case "$host" in
        '') return 1 ;;
        *[!A-Za-z0-9.-]*) return 1 ;;
      esac
      # A wildcard label, or a bare dot, is not a host.
      case "$host" in
        \** | *\** | .* | *..* | *.) return 1 ;;
      esac
      # Port must be numeric when present.
      if [ -n "$port" ]; then
        case "$port" in
          *[!0-9]*) return 1 ;;
        esac
        # Anything above 65535 is not a port.
        [ "$port" -ge 1 ] && [ "$port" -le 65535 ] || return 1
      fi
      # Plain HTTP is only allowed to a loopback address.
      if [ "$scheme" = "http" ]; then
        case "$host" in
          localhost | 127.*) : ;;
          *) return 1 ;;
        esac
      fi
      return 0
      ;;
    *) return 1 ;;
  esac
}

if [ -n "$normalised" ]; then
  # Iterate tokens without relying on word splitting of a quoted string.
  tokens=$(printf '%s\n' "$normalised" | tr ' ' '\n')
  if [ -z "$tokens" ]; then
    fail "is empty after normalisation"
  fi
  for token in $tokens; do
    [ -z "$token" ] && continue
    if ! is_valid_source "$token"; then
      fail "contains an entry that is not an allowed origin: '${token}'"
    fi
  done
fi

if [ -z "$normalised" ]; then
  export ZEUS_BYOK_CONNECT_SRC_SPACED=""
else
  export ZEUS_BYOK_CONNECT_SRC_SPACED=" $normalised"
fi

exec /docker-entrypoint.sh "$@"
