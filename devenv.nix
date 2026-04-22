{ pkgs, ... }:

{
  # Node.js + Playwright tooling
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
    yarn.enable = true;
    yarn.install.enable = true;
  };

  packages = with pkgs; [
    chromium
    kubectl
  ];

  env = {
    # Playwright must use NixOS-patched Chromium (not its own download)
    PLAYWRIGHT_CHROMIUM_PATH = "${pkgs.chromium}/bin/chromium";
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
    NODE_TLS_REJECT_UNAUTHORIZED = "0";
  };

  # Warn if .env is missing
  enterShell = ''
    if [ ! -f .env ]; then
      echo "WARNING: No .env file — copy .env.example and fill in credentials"
    fi
    echo "Rancher E2E ready — chromium, node, kubectl wired"
  '';
}
