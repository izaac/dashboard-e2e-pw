{ pkgs, lib, ... }:

let
  isLinux = pkgs.stdenv.isLinux;
in
{
  # Node.js + Playwright tooling
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
    yarn.enable = true;
    yarn.install.enable = true;
  };

  packages = with pkgs;
    [kubectl]
    ++ lib.optionals isLinux [chromium];

  env =
    {
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
      NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }
    // lib.optionalAttrs isLinux {
      # NixOS/Linux: use system Chromium (Playwright's bundled one won't work)
      PLAYWRIGHT_CHROMIUM_PATH = "${pkgs.chromium}/bin/chromium";
    };

  # Warn if .env is missing
  enterShell = ''
    if [ ! -f .env ]; then
      echo "WARNING: No .env file — copy .env.example and fill in credentials"
    fi
    echo "Rancher E2E ready — node, kubectl wired"
  '';
}
