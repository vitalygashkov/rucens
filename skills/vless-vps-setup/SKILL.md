---
name: vless-vps-setup
description: Configure and verify Xray VLESS with REALITY and XTLS Vision on a Linux VPS for ordinary phone clients such as Karing and Happ. Use for a new server or an additional inbound alongside another VPN. Do not use for router TProxy setups or certificate-based VLESS behind a user-owned domain.
---

# Configure Xray VLESS REALITY

Set up a VLESS REALITY server that listens on TCP 443 and produce an importable `vless://` URI. The expected clients are Karing, Happ, or another client with REALITY, XTLS Vision, and TUN support.

Keep the server setup generic. Full-tunnel mode and bypass rules for Russian sites belong in the client. Do not add country-based routing to Xray unless the user asks for it.

Commands assume a Linux distribution supported by the official Xray installer, systemd, root privileges, and Bash. Firewall commands are conditional examples. This template listens over IPv4; client IPv6 routing must be configured separately. Stop on failed installation or configuration commands.

## Operating rules

- Work only on the VPS the user authorized. An existing setup request covers the necessary installation steps; do not ask again for the same authorization.
- Start with read-only checks. State which live services, ports, firewall rules, and configuration files the installation will touch.
- Do not weaken SSH, replace the firewall, remove packages, or disturb another VPN.
- Back up an existing Xray configuration before replacing it. If TCP 443 is occupied, identify the service and resolve the port choice before installation. Do not stop nginx, Caddy, or an existing inbound to free it.
- Treat the UUID, REALITY private key, client password/public key, short ID, SSH credentials, and complete client URI as secrets. Do not paste them into ordinary logs or the final narrative.
- Prefer one UUID and short ID per device. One credential can work on several devices at once, but separate credentials make revocation and diagnosis much easier.
- Never declare success based only on an open port. Validate the config, fallback behavior, and one authenticated client connection.

## Required inputs

Collect or infer these values before changing the server:

- SSH host, user, and authentication method
- public IPv4 address of the VPS
- Linux distribution and architecture
- client labels, for example `phone` and `tablet`
- whether TCP 443 is free and reachable through both the OS firewall and provider firewall
- chosen REALITY target and SNI

A domain owned by the user is not required for REALITY.

Assume the user's clients and home network are suitable for this setup. Do not ask for the Keenetic/router model, firmware version, or LAN subnet as prerequisites, including when VLESS is installed alongside AmneziaWG. The user is responsible for reporting compatibility limitations or unusual LAN addressing. Revisit these details only if the user reports a relevant limitation or troubleshooting reveals a concrete conflict.

## Preflight

Run read-only checks first:

```bash
uname -a
cat /etc/os-release
ip -br address
ip route
ss -lntup
timedatectl status
systemctl --failed --no-pager
systemctl list-unit-files | grep -E 'xray|v2ray' || true
command -v ufw >/dev/null && ufw status verbose || true
command -v nft >/dev/null && nft list ruleset || true
df -h /
free -h
```

Confirm that the server has working outbound DNS, TCP 443 access, correct time, and at least a few hundred MiB of free memory. Xray itself is light, but a starved VPS is a poor place to diagnose network problems.

If another VPN is present, keep it. VLESS on TCP 443 can coexist with WireGuard or AmneziaWG on a UDP port. Check the actual listeners rather than assuming there is no conflict.

## Select and validate the REALITY target

Do not choose a random famous website. Failed REALITY authentication is forwarded to the configured target. A bad target can make the VPS useful as an unwanted forwarding node or create an obvious mismatch between the VPS location and the borrowed TLS endpoint.

Prefer a stable HTTPS endpoint that:

- is reachable directly from the VPS;
- supports TLS 1.3;
- accepts the selected SNI and returns a certificate whose SAN covers it;
- behaves consistently with and without SNI;
- is not an arbitrary free CDN endpoint;
- is geographically and operationally plausible for the VPS;
- has a certificate chain large enough for the REALITY features in use.

The official Xray guidance prefers a target in the same ASN where practical. Do not add fallback rate limiting by reflex. Xray documents that rate limiting can itself become a fingerprint. Consider it only after reviewing the current REALITY documentation and the abuse risk of the selected target.

Select the target for this VPS and probe it immediately before configuring REALITY. Replace these placeholders with the chosen hostnames:

```bash
target_host='<TARGET_HOST>'
server_name='<SERVER_NAME>'
target_ip=$(getent ahostsv4 "$target_host" | awk 'NR == 1 { print $1 }')
test -n "$target_ip" || exit 1

openssl s_client -connect "$target_ip:443" -tls1_3 \
  -servername "$server_name" -verify_hostname "$server_name" \
  -verify_return_error </dev/null

openssl s_client -connect "$target_ip:443" -tls1_3 \
  -noservername -verify_hostname "$server_name" \
  -verify_return_error </dev/null
```

Check each probe's exit status and negotiated TLS details. After Xray is available, also run `xray tls ping -ip "$target_ip" "$server_name"`. Reject a target with certificate failures, unstable TLS behavior, or forwarding-abuse concerns. Record the chosen target and SNI.

## Install or reuse Xray

If Xray is already installed, inspect `xray version` and `systemctl cat xray` first. Reuse a compatible installation. Adding an inbound does not require upgrading the binary or replacing the service unit. Preserve existing inbounds, outbounds, and routing; give the new inbound a unique tag and route it to the intended outbound. Upgrade only when required and authorized, with a rollback plan for both binary and configuration.

For a fresh installation, select a stable version from the official releases and record it. Download the official installer at a reviewed commit, inspect it, then run the selected version's installation. The installer can start services itself, so do not use this path on an existing installation.

```bash
xray_version='<SELECTED_VERSION>'
installer_commit='<REVIEWED_INSTALLER_COMMIT>'
install_script=$(mktemp)
curl --proto '=https' --proto-redir '=https' -fL --retry 5 \
  "https://raw.githubusercontent.com/XTLS/Xray-install/$installer_commit/install-release.sh" \
  -o "$install_script"
```

After a successful download and source inspection:

```bash
bash "$install_script" install --version "$xray_version"
rm -f -- "$install_script"
xray version
systemctl cat xray
```

Confirm the installed version. Follow documentation or source for that release when fields differ, including `users`/`clients` and `target`/`dest`. Validate with the installed binary, then prove authentication with a real client; JSON validation alone does not establish compatibility.

## Generate credentials

Generate a distinct UUID and random 8-byte short ID for each device. For a new REALITY inbound, generate a server key pair. Capture output without logging it:

```bash
set +x
umask 077
client_uuid=$(xray uuid)
short_id=$(openssl rand -hex 8)
reality_keys=$(xray x25519)
```

Parse the installed version's output in the private shell session, without printing it into tool output. `PrivateKey` goes into server `privateKey`; `Password`, or `PublicKey` in older versions, goes into client URI `pbk`. Do not substitute a `Hash32` value. Check the release's source if labels differ. Reuse the existing server key pair when adding users to an inbound.

Write configuration and URI files without exposing their contents in logs. Afterward, unset `client_uuid`, `short_id`, `reality_keys`, and any variables holding parsed keys. Short IDs must contain an even number of hexadecimal characters, at most 16.

## Write the server configuration

Inspect the actual service command and configuration path first. The official installer normally uses `/usr/local/etc/xray/config.json`. Before editing an existing file:

```bash
config=/usr/local/etc/xray/config.json
backup=$(mktemp "${config}.bak.XXXXXX")
cp -p -- "$config" "$backup"
chmod 600 "$backup"
systemctl show xray -p User -p Group -p ExecStart
```

Keep the backup protected and retain its path. Fill every placeholder. The full template below is for a fresh server; merge only the needed inbound and routing changes into an existing configuration.

The template below follows the current Xray documentation. If the installed release rejects `users`, consult the matching release documentation and use `clients` only when that release expects it.

```json
{
  "log": {
    "loglevel": "warning"
  },
  "inbounds": [
    {
      "tag": "vless-reality-in",
      "listen": "0.0.0.0",
      "port": 443,
      "protocol": "vless",
      "settings": {
        "users": [
          {
            "id": "<CLIENT_UUID>",
            "email": "<CLIENT_LABEL>",
            "flow": "xtls-rprx-vision"
          }
        ],
        "decryption": "none"
      },
      "streamSettings": {
        "network": "tcp",
        "security": "reality",
        "realitySettings": {
          "show": false,
          "target": "<TARGET_HOST>:443",
          "xver": 0,
          "serverNames": [
            "<SERVER_NAME>"
          ],
          "privateKey": "<REALITY_PRIVATE_KEY>",
          "shortIds": [
            "<SHORT_ID>"
          ]
        }
      }
    }
  ],
  "outbounds": [
    {
      "tag": "direct",
      "protocol": "freedom"
    }
  ]
}
```

For more devices, add one entry under `users` and preferably one short ID per device. Give each entry a useful label. Do not log browsing destinations at `info` level longer than needed for commissioning.

Create the file under `umask 077`. Use root ownership and `0600` for a root service, or `0640` with an appropriate restricted group for a non-root service. Resolve an omitted service `Group` from the user's primary group. Verify that the actual service account can read the file and traverse its parent directories.

## Validate before restart

Use the service's actual configuration path or configuration-directory arguments throughout. Do not restart Xray until the complete configuration passes validation:

```bash
xray run -test -config /usr/local/etc/xray/config.json
```

If validation fails, fix the named field. Do not repeatedly restart a broken service.

When the test succeeds:

```bash
systemctl enable xray
systemctl restart xray
systemctl --no-pager --full status xray
ss -ltnp '( sport = :443 )'
journalctl -u xray -n 100 --no-pager
```

Open only TCP 443 in the active firewall. For already active UFW:

```bash
ufw allow 443/tcp
ufw status verbose
```

Preserve SSH access and existing rules. For another firewall, add a persistent allow rule in its existing input chain, accounting for earlier drops and chain priorities. Do not enable a disabled firewall incidentally. Also check the provider's external firewall or security group.

## Produce the client URI

Build one URI per client:

```text
vless://<CLIENT_UUID>@<SERVER_IP>:443?encryption=none&flow=xtls-rprx-vision&security=reality&sni=<SERVER_NAME>&fp=chrome&pbk=<REALITY_CLIENT_PASSWORD_OR_PUBLIC_KEY>&sid=<SHORT_ID>&type=tcp#<PROFILE_NAME>
```

Use the selected SNI for `<SERVER_NAME>` and the VPS public IP for `<SERVER_IP>`. Percent-encode the profile name and any query values that require URI escaping.

Give the user the URI in a file with permissions `0600` or another channel they requested. Remove temporary credential files created during setup after confirming delivery. In the ordinary response, state where it was saved without repeating it. A QR code is optional and should be generated only if the user wants one.

## Client setup

In Karing or Happ:

1. Import the `vless://` URI.
2. Select the imported profile.
3. Enable TUN or VPN mode for a full tunnel.
4. Put Russian-site bypass lists and other split-routing rules in the client.
5. Keep DNS inside the client tunnel unless the chosen client policy intentionally sends bypassed domains to a local resolver.

On Android and iOS, only one system VPN/TUN provider is normally active at a time. Do not expect an AmneziaWG app and Karing/Happ TUN to own the phone's VPN slot simultaneously.

## Prove that it works

Run all applicable checks.

### Server checks

```bash
systemctl is-active xray
systemctl is-enabled xray
ss -ltnp '( sport = :443 )'
journalctl -u xray --since '-10 minutes' --no-pager
```

### Unauthenticated fallback check

From a machine outside the VPS, send ordinary HTTPS to the VPS while using the selected SNI:

```bash
curl -I --http2 \
  --resolve '<SERVER_NAME>:443:<SERVER_IP>' \
  'https://<SERVER_NAME>/' \
  --connect-timeout 10 --max-time 20
```

Require successful certificate and hostname verification plus an HTTP response consistent with the target. A target-generated `200`, redirect, or error such as `400` can all qualify; TCP connectivity alone cannot. Do not disable TLS verification.

### Authenticated end-to-end check

From a device outside the VPS, import the URI into Karing, Happ, sing-box, or an Xray client and make an Internet request through it. Confirm that:

- the observed public IPv4 equals the VPS IPv4;
- ordinary HTTPS browsing works;
- DNS and IPv6 behavior match the client's selected routing policy, with no unintended direct IPv6 path;
- the Xray service stays active and records no authentication or transport errors.

If the client offers delay testing, treat it as a preliminary check. Some tests reach only the proxy endpoint. A real web request through the tunnel is the proof. If an external client is unavailable, report end-to-end verification as pending.

## Troubleshooting

### Neither VLESS nor another VPN on the same VPS works

Check SSH reachability, service status, listeners, resource exhaustion, and kernel logs. Record the failure time before restarting anything. If other networks can connect, investigate the affected client's network path and VPN/TUN state.

At the normal `warning` log level, absence of access-log entries does not prove that packets never arrived. During a live recurrence, observe TCP 443 without changing the service:

```bash
timeout 30 tcpdump -ni any 'tcp port 443'
```

If `tcpdump` is unavailable, temporarily using Xray's `info` log level is another option, but it records destination hostnames. Get the user's agreement, keep the interval short, and restore `warning` afterward.

### Port 443 works but VLESS does not

Check the UUID, flow, SNI, fingerprint, client password/public key, short ID, and transport type. A mismatch in any one of them can leave ordinary fallback HTTPS working while authenticated REALITY fails.

### VLESS connects but websites do not open

Test outbound connectivity and DNS from the VPS. Then inspect the client's TUN, DNS, IPv6, and routing policy. The server does not implement the phone's bypass list.

### Service fails after editing JSON

Run `xray run -test` and inspect `journalctl -u xray`. If the failure cannot be corrected promptly, restore the saved configuration with `cp -p -- "$backup" "$config"`, reapply the service-readable permissions, validate, and restart. Do not leave the service in a restart loop. A binary upgrade also requires its matching rollback procedure.

## Completion report

Report only facts the checks proved:

- installed Xray version;
- listening address and TCP port;
- selected target and SNI;
- service enabled and active state;
- fallback test result;
- authenticated client test result;
- location of the secret-bearing client URI;
- any remaining provider-firewall or client-side work.

Do not print the REALITY private key, SSH password, or complete URI in the report.

## Authoritative references

- [Xray REALITY configuration](https://xtls.github.io/en/config/transports/reality.html)
- [Xray VLESS inbound configuration](https://xtls.github.io/en/config/inbounds/vless.html)
- [Official Xray installation script](https://github.com/XTLS/Xray-install)
- [Xray-core releases](https://github.com/XTLS/Xray-core/releases)
