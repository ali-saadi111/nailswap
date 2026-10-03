#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if [[ ${EUID} -ne 0 ]]; then echo 'Run: sudo bash setup.sh'; exit 1; fi
source /etc/os-release
case "${ID}:${VERSION_ID}" in
  ubuntu:22.04|ubuntu:24.04|ubuntu:26.04|debian:12|debian:13) ;;
  *) echo 'Supported: Ubuntu 22.04/24.04/26.04 or Debian 12/13.'; exit 1 ;;
esac
[[ $(uname -m) == x86_64 || $(uname -m) == aarch64 ]] || { echo '64-bit x86 or ARM required.'; exit 1; }
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git openssl python3 python3-yaml
if ! command -v docker >/dev/null; then
  for pkg in docker.io docker-compose docker-compose-v2 podman-docker containerd runc; do
    if dpkg-query -W -f='${Status}' "$pkg" 2>/dev/null | grep -q 'install ok installed'; then
      echo "Existing package $pkg needs a manual Docker migration; no packages removed."; exit 1
    fi
  done
  install -m 0755 -d /etc/apt/keyrings
  curl --fail --silent --show-error --location "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/${ID}
Suites: ${UBUNTU_CODENAME:-${VERSION_CODENAME}}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
docker compose version >/dev/null || { echo 'Docker Compose v2 plugin is required.'; exit 1; }
exec python3 installer.py
