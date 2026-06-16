#!/usr/bin/env bash
# k3d-based Rancher provisioning provider (PROVIDER=k3d).
#
# Replaces the docker-run Rancher containers (deprecated install method) with a
# Helm-chart install on a per-instance k3d cluster. One k3d cluster per Rancher
# instance; sharded runs use two instances (e2e-1, e2e-2).
#
# Usage:
#   scripts/k3d-rancher.sh up   <instance>   # create cluster + install rancher + wait
#   scripts/k3d-rancher.sh wait <instance>   # readiness gates only
#   scripts/k3d-rancher.sh logs <instance>   # rancher + webhook pod logs to stdout
#   scripts/k3d-rancher.sh env  <instance>   # print the handoff env file
#   scripts/k3d-rancher.sh down <instance>   # delete cluster + handoff file
#
# Instances: e2e (single, host ports 8443/8080), e2e-1, e2e-2 (sharded; ports 8444/8081, 8445/8082).
#
# Tunables (env):
#   RANCHER_RELEASE       chart line on charts.optimus.rancher.io (default 2.15 — the head line).
#                         Fallback if optimus is unreachable:
#                         helm repo add rancher-latest https://releases.rancher.com/server-charts/latest
#   RANCHER_IMAGE_TAG     rancher image tag (default head)
#   RANCHER_PASSWORD      bootstrap password (default password1234, matches compose)
#   K3S_IMAGE             k3d node image (default rancher/k3s:v1.33.1-k3s1, upstream e2e-k3s-start pin)
#   CERT_MANAGER_VERSION  default v1.7.1 (upstream parity)
#   AUDIT_LOG             1 enables rancher audit log sidecar at level 3 (default 0)
#   DASHBOARD_DIST        optional path to a locally built dashboard dist/. Enables
#                         PR-build UI mode: the dir is mounted into the k3s node and
#                         hostPath-mounted over the rancher pod's dashboard, with
#                         CATTLE_UI_OFFLINE_PREFERRED=true. Default off (the suite
#                         tests the image's CDN-resolved dashboard).
#   EXTERNAL              true => `up` starts a cloudflared quick tunnel and installs
#                         Rancher on that public host so downstream nodes can register
#                         (provisioning tests). Default off (docker-internal sslip.io).
#   EXTERNAL_HOSTNAME     explicit public host to install on (skips the auto tunnel).
#
# Handoff: writes /tmp/k3d-rancher-<instance>.env with TEST_BASE_URL, RANCHER_LB_IP,
# K3D_NETWORK, HOST_HTTPS_PORT, KUBECONFIG for consumption by run scripts / compose.

set -euo pipefail

RANCHER_RELEASE="${RANCHER_RELEASE:-2.15}"
RANCHER_IMAGE_TAG="${RANCHER_IMAGE_TAG:-head}"
RANCHER_PASSWORD="${RANCHER_PASSWORD:-password1234}"
K3S_IMAGE="${K3S_IMAGE:-rancher/k3s:v1.33.1-k3s1}"
CERT_MANAGER_VERSION="${CERT_MANAGER_VERSION:-v1.7.1}"
AUDIT_LOG="${AUDIT_LOG:-0}"
DASHBOARD_DIST="${DASHBOARD_DIST:-}"

# External access (optional): when set, Rancher is installed with this public
# hostname instead of the docker-internal <lb_ip>.sslip.io. Pair it with a
# cloudflared quick tunnel (see the 'tunnel' subcommand) so an out-of-cluster
# node agent can resolve and reach the server-url to register.
EXTERNAL_HOSTNAME="${EXTERNAL_HOSTNAME:-}"

# Convenience switch for the provisioning flow: EXTERNAL=true makes `up` start a
# cloudflared quick tunnel itself and use the allocated public host as
# EXTERNAL_HOSTNAME, so a developer with cloud credentials can run
#   EXTERNAL=true scripts/k3d-rancher.sh up e2e
# without juggling the tunnel host by hand. An explicit EXTERNAL_HOSTNAME still
# wins (bring-your-own named tunnel / custom DNS).
EXTERNAL="${EXTERNAL:-}"

# Pinned cloudflared for the tunnel helper. Checksums are verified on download
# so a tampered or truncated binary is never executed. Bump VERSION and both
# sums together (sha256sum cloudflared-linux-<arch>).
CLOUDFLARED_VERSION="${CLOUDFLARED_VERSION:-2026.6.0}"
CLOUDFLARED_SHA256_amd64="08d27c4c5d3ed73ee3e98ef2ddceb4ad09fd4cfc28e243565a189538e8ccd706"
CLOUDFLARED_SHA256_arm64="8482ebf1e74a2a4a1a9f1e090e17e3de08423f94100ece6789287cb26fb9480f"

CMD="${1:-}"
INSTANCE="${2:-}"

usage() {
  sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
}

if [ -z "$CMD" ] || [ -z "$INSTANCE" ]; then
  usage >&2
  exit 2
fi

# Instance index drives host port offsets: e2e -> 0, e2e-1 -> 1, e2e-2 -> 2
case "$INSTANCE" in
  e2e) IDX=0 ;;
  e2e-[0-9]) IDX="${INSTANCE##*-}" ;;
  *)
    echo "FATAL: instance must be 'e2e' or 'e2e-<n>' (got '$INSTANCE')" >&2
    exit 2
    ;;
esac

HOST_HTTPS_PORT=$((8443 + IDX))
HOST_HTTP_PORT=$((8080 + IDX))
ENV_FILE="/tmp/k3d-rancher-${INSTANCE}.env"
NETWORK="k3d-${INSTANCE}"

# True for 1/true/yes/on (case-insensitive); false otherwise.
is_true() {
  case "$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')" in
    1 | true | yes | on) return 0 ;;
    *) return 1 ;;
  esac
}

kubeconfig() {
  k3d kubeconfig write "$INSTANCE" 2>/dev/null
}

kc() {
  kubectl --kubeconfig "$(kubeconfig)" "$@"
}

lb_ip() {
  docker inspect "k3d-${INSTANCE}-serverlb" \
    --format "{{(index .NetworkSettings.Networks \"${NETWORK}\").IPAddress}}"
}

# Find a CA bundle for HTTPS downloads so callers do not have to export
# SSL_CERT_FILE/CURL_CA_BUNDLE by hand. Honours those if already set, then the
# Nix-provided bundle, then the common system locations. Prints nothing if none
# is found (curl falls back to its built-in default).
ca_bundle() {
  local c
  for c in \
    "${SSL_CERT_FILE:-}" \
    "${CURL_CA_BUNDLE:-}" \
    "${NIX_SSL_CERT_FILE:-}" \
    /etc/ssl/certs/ca-certificates.crt \
    /etc/ssl/certs/ca-bundle.crt \
    /etc/pki/tls/certs/ca-bundle.crt; do
    if [ -n "$c" ] && [ -r "$c" ]; then
      echo "$c"
      return 0
    fi
  done
}

# Resolve a verified cloudflared binary, downloading the pinned release if one is
# not already on PATH. Prints the absolute path on stdout; all logging goes to
# stderr so the path can be captured by callers.
ensure_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then
    command -v cloudflared
    return 0
  fi

  local arch want
  case "$(uname -m)" in
    x86_64) arch=amd64; want="$CLOUDFLARED_SHA256_amd64" ;;
    aarch64 | arm64) arch=arm64; want="$CLOUDFLARED_SHA256_arm64" ;;
    *)
      echo "FATAL: unsupported arch '$(uname -m)' for cloudflared bootstrap" >&2
      return 1
      ;;
  esac

  local cache_dir="${XDG_CACHE_HOME:-$HOME/.cache}/dashboard-e2e"
  local bin="${cache_dir}/cloudflared-${CLOUDFLARED_VERSION}-${arch}"
  mkdir -p "$cache_dir"

  if [ -x "$bin" ] && [ "$(sha256sum "$bin" | awk '{print $1}')" = "$want" ]; then
    echo "$bin"
    return 0
  fi

  local url="https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-${arch}"
  echo "--- cloudflared: downloading pinned ${CLOUDFLARED_VERSION} (${arch}) ---" >&2
  local tmp="${bin}.tmp.$$"
  local curl_args=(-fsSL -o "$tmp")
  local ca
  ca="$(ca_bundle)"
  [ -n "$ca" ] && curl_args+=(--cacert "$ca")
  if ! curl "${curl_args[@]}" "$url"; then
    rm -f "$tmp"
    echo "FATAL: cloudflared download failed: $url" >&2
    return 1
  fi

  local got
  got="$(sha256sum "$tmp" | awk '{print $1}')"
  if [ "$got" != "$want" ]; then
    rm -f "$tmp"
    echo "FATAL: cloudflared checksum mismatch (${arch})" >&2
    echo "  expected: $want" >&2
    echo "  got:      $got" >&2
    return 1
  fi

  chmod +x "$tmp"
  mv -f "$tmp" "$bin"
  echo "--- cloudflared: verified and cached at $bin ---" >&2
  echo "$bin"
}

# Start a cloudflared quick tunnel in front of this instance's Rancher and print
# the public https URL it allocated. The tunnel runs detached; its pid and url
# are recorded next to the handoff env so 'down' can stop it.
do_tunnel() {
  local cf url log pidfile
  cf="$(ensure_cloudflared)"
  log="/tmp/k3d-tunnel-${INSTANCE}.log"
  pidfile="/tmp/k3d-tunnel-${INSTANCE}.pid"
  : > "$log"

  # No --http-host-header override: 'up' installs Rancher with hostname equal to
  # the tunnel host, so the ingress matches the request Host natively.
  setsid "$cf" tunnel --url "https://localhost:${HOST_HTTPS_PORT}" --no-tls-verify \
    >> "$log" 2>&1 &
  echo "$!" > "$pidfile"

  local i
  for i in $(seq 1 30); do
    url="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$log" | head -1 || true)"
    [ -n "$url" ] && break
    sleep 1
  done
  if [ -z "$url" ]; then
    echo "FATAL: cloudflared did not report a tunnel url (see $log)" >&2
    return 1
  fi
  echo "$url"
}


retry() {
  # retry <attempts> <sleep_s> <description> -- <command...>
  local attempts="$1" sleep_s="$2" desc="$3" i
  shift 3
  [ "$1" = "--" ] && shift
  for i in $(seq 1 "$attempts"); do
    if "$@" >/dev/null 2>&1; then
      echo "ready: $desc (attempt $i/$attempts)"
      return 0
    fi
    sleep "$sleep_s"
  done
  echo "FATAL: $desc not ready after $attempts attempts" >&2
  return 1
}

do_up() {
  command -v k3d >/dev/null || { echo "FATAL: k3d not in PATH (enter devenv shell)" >&2; exit 1; }
  command -v helm >/dev/null || { echo "FATAL: helm not in PATH (enter devenv shell)" >&2; exit 1; }

  # EXTERNAL=true with no explicit hostname: bring up the quick tunnel first and
  # adopt its host. cloudflared allocates and prints the URL before the origin
  # is reachable, so starting it ahead of the cluster is fine (and matches the
  # validated tunnel-first flow where the ingress is installed with this host).
  if [ -z "$EXTERNAL_HOSTNAME" ] && is_true "$EXTERNAL"; then
    echo "--- external mode: starting cloudflared quick tunnel ---"
    local tunnel_url
    tunnel_url="$(do_tunnel)"
    EXTERNAL_HOSTNAME="${tunnel_url#https://}"
    echo "--- external hostname: ${EXTERNAL_HOSTNAME} ---"
  fi

  local create_args=(
    cluster create "$INSTANCE"
    --servers 1 --agents 0
    --image "$K3S_IMAGE"
    --network "$NETWORK"
    -p "${HOST_HTTPS_PORT}:443@loadbalancer"
    -p "${HOST_HTTP_PORT}:80@loadbalancer"
    --wait --timeout 180s
  )

  if [ -n "$DASHBOARD_DIST" ]; then
    create_args+=(-v "${DASHBOARD_DIST}:/dashboard-dist@server:0")
  fi

  echo "--- k3d: creating cluster $INSTANCE ---"
  k3d "${create_args[@]}"

  local ip hostname
  ip="$(lb_ip)"
  hostname="${ip}.sslip.io"

  if [ -n "$EXTERNAL_HOSTNAME" ]; then
    hostname="$EXTERNAL_HOSTNAME"
  fi

  # sslip preflight: corporate/odd DNS setups sometimes rewrite or block sslip.io.
  if ! getent hosts "$hostname" >/dev/null; then
    echo "FATAL: '$hostname' does not resolve — local DNS is blocking sslip.io." >&2
    echo "Escape hatch: add an extra_hosts/--add-host mapping for a fixed hostname" >&2
    echo "and pass it via RANCHER_HOSTNAME (see docs/RUNNING-TESTS.md k3d section)." >&2
    k3d cluster delete "$INSTANCE"
    exit 1
  fi

  echo "--- cert-manager ${CERT_MANAGER_VERSION} ---"
  kc apply -f "https://github.com/jetstack/cert-manager/releases/download/${CERT_MANAGER_VERSION}/cert-manager.crds.yaml"
  helm --kubeconfig "$(kubeconfig)" repo add jetstack https://charts.jetstack.io --force-update
  helm --kubeconfig "$(kubeconfig)" upgrade --install cert-manager jetstack/cert-manager \
    --namespace cert-manager --create-namespace \
    --version "$CERT_MANAGER_VERSION" --wait --timeout 5m
  kc -n cert-manager rollout status deploy/cert-manager-webhook --timeout=180s

  echo "--- rancher chart (release line ${RANCHER_RELEASE}, image tag ${RANCHER_IMAGE_TAG}) ---"
  helm --kubeconfig "$(kubeconfig)" repo add "rancher-e2e-${RANCHER_RELEASE}" \
    "https://charts.optimus.rancher.io/server-charts/release-${RANCHER_RELEASE}" --force-update

  local helm_args=(
    upgrade --install rancher "rancher-e2e-${RANCHER_RELEASE}/rancher"
    --devel
    --namespace cattle-system --create-namespace
    --set "hostname=${hostname}"
    --set "replicas=1"
    --set "rancherImage=rancher/rancher"
    --set "rancherImageTag=${RANCHER_IMAGE_TAG}"
    --set "rancherImagePullPolicy=Always"
    --set "bootstrapPassword=${RANCHER_PASSWORD}"
    --set "ingress.ingressClassName=traefik"
    --set "extraEnv[0].name=CATTLE_AGENT_IMAGE"
    --set-string "extraEnv[0].value=rancher/rancher-agent:${RANCHER_IMAGE_TAG}"
  )

  local next_env=1

  if [ "$AUDIT_LOG" = "1" ]; then
    helm_args+=(--set "auditLog.enabled=true" --set "auditLog.level=3")
  fi

  if [ -n "$DASHBOARD_DIST" ]; then
    helm_args+=(
      --set "extraEnv[${next_env}].name=CATTLE_UI_OFFLINE_PREFERRED"
      --set-string "extraEnv[${next_env}].value=true"
    )
  fi

  helm --kubeconfig "$(kubeconfig)" "${helm_args[@]}"

  if [ -n "$DASHBOARD_DIST" ]; then
    echo "--- PR-build UI mode: hostPath-mounting dashboard dist over the pod UI ---"
    kc -n cattle-system patch deploy rancher --type=strategic -p '{
      "spec": {"template": {"spec": {
        "volumes": [{"name": "dashboard-dist", "hostPath": {"path": "/dashboard-dist", "type": "Directory"}}],
        "containers": [{"name": "rancher", "volumeMounts": [{"name": "dashboard-dist", "mountPath": "/usr/share/rancher/ui-dashboard/dashboard"}]}]
      }}}
    }'
  fi

  {
    echo "TEST_BASE_URL=https://${hostname}/dashboard"
    echo "RANCHER_LB_IP=${ip}"
    echo "RANCHER_HOSTNAME=${hostname}"
    echo "K3D_NETWORK=${NETWORK}"
    echo "HOST_HTTPS_PORT=${HOST_HTTPS_PORT}"
    echo "KUBECONFIG=$(kubeconfig)"
  } > "$ENV_FILE"
  echo "--- handoff written: $ENV_FILE ---"

  do_wait
}

do_wait() {
  local ip hostname
  ip="$(lb_ip)"
  hostname="${ip}.sslip.io"
  [ -n "$EXTERNAL_HOSTNAME" ] && hostname="$EXTERNAL_HOSTNAME"

  echo "--- waiting: rancher deployment rollout ---"
  kc -n cattle-system rollout status deploy/rancher --timeout=600s

  if [ -n "$EXTERNAL_HOSTNAME" ]; then
    echo "--- external mode: pinning server-url to https://${hostname} ---"
    retry 20 5 "server-url set" -- \
      kc patch settings.management.cattle.io server-url --type=merge \
        -p "{\"value\":\"https://${hostname}\"}"

    # The tunnel terminates TLS with its own publicly-trusted cert, not the
    # Rancher ingress cert. With the default 'strict' mode a downstream node
    # agent pins Rancher's internal CA and rejects the tunnel cert, so it never
    # checks in. 'system-store' makes agents trust the public cert instead.
    echo "--- external mode: setting agent-tls-mode=system-store ---"
    retry 20 5 "agent-tls-mode set" -- \
      kc patch settings.management.cattle.io agent-tls-mode --type=merge \
        -p '{"value":"system-store"}'
  fi

  echo "--- waiting: dashboard responds 200 ---"
  retry 20 5 "dashboard HTTP 200" -- \
    sh -c "curl -skI --max-time 5 'https://${hostname}/dashboard/' | head -1 | grep -q ' 200'"

  # 90 attempts (15 min) covers cold GitHub-hosted runners where the 4 vCPU
  # standard image saturates during CRD apply + webhook chart install and the
  # gate timing is highly variable run-to-run. Locally this comes up in ~90s.
  echo "--- waiting: rancher-webhook pod ready ---"
  retry 90 10 "rancher-webhook 1/1 Running" -- \
    sh -c "kubectl --kubeconfig '$(kubeconfig)' -n cattle-system get po -l app=rancher-webhook 2>/dev/null | grep -q '1/1.*Running'"

  # head (>=2.15, Rancher Turtles) deploys CAPI into cattle-capi-system; older
  # lines used cattle-provisioning-capi-system (upstream e2e-k3s-start still
  # checks the old one). Accept either. Same budget as the webhook gate since
  # CAPI rides the same controller-cascade timing.
  echo "--- waiting: capi-webhook-service exists ---"
  retry 90 10 "capi-webhook-service" -- \
    sh -c "kubectl --kubeconfig '$(kubeconfig)' -n cattle-capi-system get service capi-webhook-service 2>/dev/null \
      || kubectl --kubeconfig '$(kubeconfig)' -n cattle-provisioning-capi-system get service capi-webhook-service 2>/dev/null"

  # Deeper signal than the dashboard page: same endpoint the compose healthcheck
  # used, proves the auth provider API is actually serving.
  echo "--- waiting: /v3-public/authProviders/local responds 200 ---"
  retry 20 5 "authProviders API 200" -- \
    sh -c "curl -sk --max-time 5 -o /dev/null -w '%{http_code}' 'https://${hostname}/v3-public/authProviders/local' | grep -q 200"

  # Kubernetes "Ready" is necessary but not sufficient — webhook is up but CRD
  # admission, leader election, fleet and turtles startup are still chewing
  # CPU for another minute or two on cold runners. Wait until docker stats
  # reports the k3d node has been below the idle threshold for SETTLE_SAMPLES
  # consecutive samples, so the test phase does not race controller chatter.
  echo "--- waiting: cluster CPU to settle ---"
  local threshold=50
  local settle_samples=3
  local sample_interval=10
  local max_attempts=30
  local low_streak=0
  local cpu i
  for i in $(seq 1 "$max_attempts"); do
    cpu=$(docker stats --no-stream --format '{{.CPUPerc}}' "k3d-${INSTANCE}-server-0" 2>/dev/null \
          | tr -d '%' | cut -d. -f1)
    cpu=${cpu:-0}
    if [ "$cpu" -lt "$threshold" ]; then
      low_streak=$((low_streak + 1))
      echo "  cpu=${cpu}% (low ${low_streak}/${settle_samples})"
      [ "$low_streak" -ge "$settle_samples" ] && { echo "settled"; break; }
    else
      low_streak=0
      echo "  cpu=${cpu}% (busy, streak reset)"
    fi
    sleep "$sample_interval"
  done
  if [ "$low_streak" -lt "$settle_samples" ]; then
    echo "WARNING: cluster CPU did not settle under ${threshold}% within 5 min — proceeding anyway"
  fi

  # External mode == provisioning intent. Prime the provisioning controller now
  # so the first real provisioning test create does not race its cold start.
  [ -n "$EXTERNAL_HOSTNAME" ] && warm_provisioning

  echo "--- rancher ready: https://${hostname}/dashboard (host port ${HOST_HTTPS_PORT}) ---"
}

# Prime the provisioning -> management.cattle.io.cluster controller path with a
# throwaway imported cluster (spec: {} mints a management cluster but creates no
# machines, so there is zero cloud cost). On a cold Rancher the first
# provisioning reconcile lags tens of seconds while the controller warms its
# informer caches; the dashboard's post-create "wait for the cluster to become
# available" loop then outlasts the test's row-visible timeout and the create
# spec flakes. Doing one throwaway reconcile here absorbs that cold start so the
# first real test create navigates immediately. Best-effort: a hiccup warns and
# proceeds rather than blocking the whole bring-up (test retries still backstop).
warm_provisioning() {
  local name="e2e-prov-warmup" ns="fleet-default" mc i
  echo "--- warm-up: priming provisioning controller (throwaway imported cluster) ---"

  if ! kc apply -f - >/dev/null 2>&1 <<EOF
apiVersion: provisioning.cattle.io/v1
kind: Cluster
metadata:
  name: ${name}
  namespace: ${ns}
spec: {}
EOF
  then
    echo "WARNING: warm-up cluster apply failed — skipping prime (tests may cold-start)" >&2
    return 0
  fi

  mc=""
  for i in $(seq 1 90); do
    mc="$(kc get clusters.provisioning.cattle.io "$name" -n "$ns" \
          -o jsonpath='{.status.clusterName}' 2>/dev/null || true)"
    [ -n "$mc" ] && break
    sleep 2
  done
  if [ -n "$mc" ]; then
    echo "warm-up: provisioning controller primed (mgmt mirror ${mc})"
  else
    echo "WARNING: warm-up mgmt mirror not observed in 180s — proceeding anyway" >&2
  fi

  kc delete clusters.provisioning.cattle.io "$name" -n "$ns" \
    --wait=true --timeout=120s >/dev/null 2>&1 || true
}

do_logs() {
  # --previous fails when no container restarted — tolerated, the current logs follow.
  kc -n cattle-system logs -l app=rancher --prefix --tail=-1 --previous 2>/dev/null || true
  kc -n cattle-system logs -l app=rancher --prefix --tail=-1
  kc -n cattle-system logs -l app=rancher-webhook --prefix --tail=-1 || true
  kc get events -A --sort-by=.lastTimestamp || true
}

do_down() {
  stop_tunnel
  k3d cluster delete "$INSTANCE" || true
  rm -f "$ENV_FILE"
}

# Stop the cloudflared tunnel for this instance: the pid we recorded plus any
# stray cloudflared whose command line targets this instance's https port (so a
# stale pidfile or a manually started tunnel is still cleaned up). PID-targeted
# kills only — no pkill/killall.
stop_tunnel() {
  local pidfile="/tmp/k3d-tunnel-${INSTANCE}.pid" p
  if [ -f "$pidfile" ]; then
    kill "$(cat "$pidfile")" 2>/dev/null || true
    rm -f "$pidfile" "/tmp/k3d-tunnel-${INSTANCE}.log"
  fi
  for p in $(pgrep -f "cloudflared.*localhost:${HOST_HTTPS_PORT}" 2>/dev/null); do
    kill "$p" 2>/dev/null || true
  done
}

do_env() {
  cat "$ENV_FILE"
}

case "$CMD" in
  up) do_up ;;
  wait) do_wait ;;
  logs) do_logs ;;
  down) do_down ;;
  env) do_env ;;
  tunnel) do_tunnel ;;
  cloudflared) ensure_cloudflared ;;
  *)
    usage >&2
    exit 2
    ;;
esac
