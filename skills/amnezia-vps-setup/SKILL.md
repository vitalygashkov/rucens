---
name: amnezia-vps-setup
description: Install and verify native AmneziaWG on an Ubuntu/Debian VPS, with separate profiles for the AmneziaWG app or compatible Keenetic/Netcraze routers. Use for a new installation or adding clients to an existing AmneziaWG server.
---

# Configure AmneziaWG on a VPS

Deliver a working `.conf` for each device on the server the user identified. Commands assume Ubuntu/Debian with systemd, root privileges, and Bash. This is a native installation using `awg-quick`, without Docker or a control panel. The Ubuntu PPA instructions do not apply to Debian. Replace angle-bracket placeholders before running examples, and stop on failed installation or configuration commands.

## Collect missing inputs

Do not ask again for information the user has already provided. If missing, ask for:

- VPS IP or hostname, OS, SSH user, and authentication method;
- the apps and devices that will connect;
- the number of independent profiles needed;
- whether to tunnel all traffic or only selected networks;
- whether the VPS has public IPv6;
- a preferred UDP port, if the user has one.

Assume the user's Keenetic or Netcraze supports the classic `wireguard asc` parameters. Do not ask for the router model, firmware version, or LAN subnet as setup prerequisites. The user is responsible for reporting unsupported hardware or firmware and unusual LAN addressing. Revisit these details only if the user reports a relevant limitation or troubleshooting reveals a concrete compatibility or subnet conflict.

## Choose the protocol version

Select the protocol from the stated client types and the defaults below without requiring a router compatibility questionnaire.

- For the official AmneziaWG app, use a current supported version.
- If clients include Keenetic/Netcraze with the `wireguard asc` CLI command, default to a compatible AWG 2.x setup with `Jc Jmin Jmax S1 S2 H1 H2 H3 H4` parameters.
- Keep router setups on the classic compatible profile unless the user explicitly requests a newer protocol and supplies its compatibility details.

All clients on one server must use compatible protocol parameters. `S1`, `S2`, and `H1`...`H4` must match the server. `Jc`, `Jmin`, and `Jmax` may technically differ, but matching values are easier to check and maintain.

## Scope and safety

- Before making changes, tell the user which server and services the work will affect.
- Do not put SSH passwords in command arguments, shell history, URLs, or client files.
- Do not print private keys or preshared keys in diagnostic output.
- Do not reuse keys or obfuscation parameters from another server.
- Do not replace the entire existing firewall ruleset.
- Do not enable UFW blindly. Allow SSH first to avoid losing access.
- Do not run `full-upgrade`, change the kernel, or reboot the VPS without a need and the user's agreement.
- Inspect existing VPNs and Docker networking before changes. Preserve their services, routes, and firewall rules. VLESS on TCP 443 can coexist with AWG on UDP; check actual listeners, interface names, and subnets.
- Do not install a third-party one-click script when official components can do the same job.
- Create a separate key pair for each device. Sharing one profile between active devices causes endpoint changes and unstable connections.
- The client private key must remain only with the user. Delete the temporary client copy from the VPS after delivery.
- After setup, suggest switching to SSH keys and changing the root password if the password was shared in the conversation.

## 1. Inventory the server

Connect over SSH and collect the initial state without making changes:

```bash
uname -a
. /etc/os-release && printf '%s %s\n' "$PRETTY_NAME" "$VERSION_CODENAME"
dpkg --print-architecture 2>/dev/null || uname -m
ip -brief address
ip route show default
ss -lntup
df -h /
free -h
timedatectl status
command -v awg || true
command -v amneziawg-go || true
command -v docker || true
systemctl status awg-quick@awg0 --no-pager 2>/dev/null || true
ufw status verbose 2>/dev/null || true
nft list ruleset 2>/dev/null || true
iptables -S 2>/dev/null || true
```

Identify and record:

- the VPS's public address;
- the external interface from the default route, such as `ens3`;
- kernel version;
- architecture;
- an available UDP port;
- the active firewall system;
- whether public IPv6 is available.

If AmneziaWG already exists, inspect its service and configuration without printing keys. When adding clients, reuse its server keys and protocol parameters, allocate unused client addresses, and append peers. Skip installation and server key regeneration; generate fresh client keys and a preshared key for each new peer. Do not overwrite an occupied interface or configuration with the fresh-install template.

Before editing an existing configuration, back it up and retain the path for rollback:

```bash
config=/etc/amnezia/amneziawg/awg0.conf
backup=$(mktemp "${config}.bak.XXXXXX")
cp -p -- "$config" "$backup"
chmod 600 "$backup"
```

If a change prevents startup, restore with `cp -p -- "$backup" "$config"`, restart the existing service, and check its status. Back up any firewall file separately before editing it.

## 2. Choose a kernel module or userspace

AmneziaWG can use a kernel module or the official `amneziawg-go` userspace implementation.

Before installation, check the current official sources:

- [AmneziaWG kernel module](https://github.com/amnezia-vpn/amneziawg-linux-kernel-module);
- [official `awg` and `awg-quick` tools](https://github.com/amnezia-vpn/amneziawg-tools);
- [`amneziawg-go` userspace implementation](https://github.com/amnezia-vpn/amneziawg-go);
- [AmneziaWG parameter constraints](https://github.com/amnezia-vpn/amneziawg-linux-kernel-module#configuration);
- [official Amnezia self-hosted server instructions](https://docs.amnezia.org/documentation/instructions/install-vpn-on-server/).

Prefer the kernel module when the official package explicitly supports the OS version and running kernel. It is faster and uses less CPU.

Use `amneziawg-go` when:

- DKMS fails to build against the running kernel;
- the VPS does not allow loading modules;
- no compatible package exists for the distribution;
- installing the module would require a questionable kernel downgrade.

## 3. Install the official package

If the exact Ubuntu version and kernel are supported, follow the official repository's current instructions. A typical installation looks like this:

```bash
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  software-properties-common python3-launchpadlib gnupg2 \
  "linux-headers-$(uname -r)"

add-apt-repository -y ppa:amnezia/ppa
apt-get update
apt-get install -y amneziawg
```

Check the result:

```bash
dkms status
modprobe amneziawg
lsmod | grep amneziawg
awg --version
awg-quick --help
```

If DKMS fails, read the build log. Do not reboot hoping the error will disappear. Switch to userspace if the problem is kernel incompatibility.

## 4. Install the userspace implementation

Select compatible tags from the official repositories and record their exact versions and commit IDs. Check protocol support and the selected tag's `go.mod` requirements against `go version`. Do not upgrade to a new protocol merely because its tag is newer. Prefer a compatible official package or release binary when available; otherwise build from source. Do not overwrite an existing source checkout or uninstall shared build dependencies afterward.

For Ubuntu/Debian:

```bash
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates git make gcc libc6-dev golang-go iptables iproute2

install -d -m 0755 /usr/local/src
cd /usr/local/src

git clone --depth 1 --branch '<AWG_GO_TAG>' \
  https://github.com/amnezia-vpn/amneziawg-go.git

git clone --depth 1 --branch '<AWG_TOOLS_TAG>' \
  https://github.com/amnezia-vpn/amneziawg-tools.git

cd /usr/local/src/amneziawg-go
make
install -m 0755 amneziawg-go /usr/local/bin/amneziawg-go

cd /usr/local/src/amneziawg-tools/src
make
make install WITH_SYSTEMDUNITS=yes
```

Check the versions and `awg-quick` fallback:

```bash
/usr/local/bin/amneziawg-go --version
/usr/bin/awg --version
grep -n 'amneziawg-go' /usr/bin/awg-quick
systemctl cat awg-quick@.service
```

An `Unknown device type` message is expected in userspace mode if `awg-quick` then reports fallback and successfully starts `amneziawg-go`. An inactive service or missing interface indicates failure; that message alone does not.

## 5. Choose the port and subnet

Use an available UDP port that the client network and provider permit, for example `585/udp`.

Do not use a port that is already occupied:

```bash
ss -lunp
```

For a personal server, use a dedicated private subnet, for example:

```text
10.8.1.0/24
server: 10.8.1.1
first client: 10.8.1.2
```

Check for overlaps with routes and VPNs visible on the VPS and any networks the user has already mentioned. Otherwise assume the home LAN does not overlap; do not request its subnet or require confirmation. Choose another RFC1918 subnet if a known overlap exists.

## 6. Obfuscation parameters

For the classic nine-parameter router-compatible profile below, use these conservative limits. Verify support against the selected component versions; newer protocol features need matching client support:

- `Jc`: 1 to 128, with a practical range of 4 to 12;
- `Jmin < Jmax`;
- `Jmax` must be below the external path MTU to avoid fragmentation; the small values generated below also fit MTU 1280;
- `S1 <= 1132` at MTU 1280;
- `S2 <= 1188` at MTU 1280;
- `S1 + 56` must not equal `S2`;
- `H1`...`H4` must be distinct numbers from 5 to 2147483647.

Generate a fresh set for each server. Example Bash generation within these limits:

```bash
jc=$((4 + RANDOM % 9))
jmin=$((8 + RANDOM % 33))
jmax=$((jmin + 20 + RANDOM % 61))
s1=$((15 + RANDOM % 136))

while :; do
  s2=$((15 + RANDOM % 136))
  [ "$s2" -ne "$((s1 + 56))" ] && break
done

random_h() {
  local random_u32
  random_u32=$(od -An -N4 -tu4 /dev/urandom)
  printf '%s\n' "$((5 + random_u32 % 2147483642))"
}

h1=$(random_h)
h2=$(random_h)
h3=$(random_h)
h4=$(random_h)

while [ "$h2" = "$h1" ]; do h2=$(random_h); done
while [ "$h3" = "$h1" ] || [ "$h3" = "$h2" ]; do h3=$(random_h); done
while [ "$h4" = "$h1" ] || [ "$h4" = "$h2" ] || [ "$h4" = "$h3" ]; do
  h4=$(random_h)
done
```

Do not print these variables alongside keys in a general log. ASC numbers themselves are not secrets, but the completed client profile contains secrets.

## 7. Client and server keys

Generate keys with the installed `awg`:

```bash
set +x
umask 077

server_private=$(awg genkey)
server_public=$(printf '%s' "$server_private" | awg pubkey)

client_private=$(awg genkey)
client_public=$(printf '%s' "$client_private" | awg pubkey)

preshared_key=$(awg genpsk)
```

Capture these values in a private shell session without tracing or printing them. After writing the configurations, run `unset server_private server_public client_private client_public preshared_key`.

For the next device, create a new client key pair and assign a new address, such as `10.8.1.3/32`. Keep the server key and obfuscation parameters unchanged.

## 8. Server configuration

The official `awg-quick` looks for its configuration here:

```text
/etc/amnezia/amneziawg/awg0.conf
```

Create the directory before writing the file, with `umask 077` still active:

```bash
install -d -m 0700 /etc/amnezia/amneziawg
```

Substitute the external interface, port, keys, and ASC parameters. The hooks below are for an unmanaged iptables ruleset with no earlier blocking rules. For UFW or a managed nftables ruleset, omit both hooks and configure forwarding and NAT through that firewall instead. Use one owner for these rules.

```ini
[Interface]
Address = 10.8.1.1/24
MTU = 1280
ListenPort = <UDP_PORT>
PrivateKey = <SERVER_PRIVATE_KEY>
Jc = <JC>
Jmin = <JMIN>
Jmax = <JMAX>
S1 = <S1>
S2 = <S2>
H1 = <H1>
H2 = <H2>
H3 = <H3>
H4 = <H4>
PostUp = iptables -A FORWARD -i %i -o <WAN_INTERFACE> -s 10.8.1.0/24 -j ACCEPT; iptables -A FORWARD -i <WAN_INTERFACE> -o %i -d 10.8.1.0/24 -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT; iptables -t nat -A POSTROUTING -s 10.8.1.0/24 -o <WAN_INTERFACE> -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -o <WAN_INTERFACE> -s 10.8.1.0/24 -j ACCEPT; iptables -D FORWARD -i <WAN_INTERFACE> -o %i -d 10.8.1.0/24 -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT; iptables -t nat -D POSTROUTING -s 10.8.1.0/24 -o <WAN_INTERFACE> -j MASQUERADE

[Peer]
PublicKey = <CLIENT_PUBLIC_KEY>
PresharedKey = <PRESHARED_KEY>
AllowedIPs = 10.8.1.2/32
```

Set the completed server file to `0600`.

Keep `PostUp` and `PostDown` rules symmetric. Otherwise, restarts can leave duplicate or stale rules.

## 9. Routing and firewall

Enable IPv4 forwarding persistently:

```bash
printf 'net.ipv4.ip_forward = 1\n' > /etc/sysctl.d/99-amneziawg.conf
sysctl -p /etc/sysctl.d/99-amneziawg.conf
sysctl net.ipv4.ip_forward
```

Open only the chosen UDP port. For an already active UFW:

```bash
ufw allow '<UDP_PORT>/udp' comment 'AmneziaWG'
ufw status verbose
```

For active UFW, also permit routed traffic from the VPN subnet through the external interface and configure persistent masquerading in its rules. Opening the UDP input port alone does not allow forwarding. For nftables, use the existing input/forward chains and a postrouting masquerade rule scoped to the VPN subnet and external interface. Check chain priorities and earlier drops; an appended accept rule may never be reached. Preserve SSH and ensure rules survive firewall reloads. Do not enable a disabled firewall as an incidental setup step.

Check the firewall in the VPS provider's panel. A local listener does not prove external reachability.

## 10. Client `.conf`

For the first device:

```ini
[Interface]
PrivateKey = <CLIENT_PRIVATE_KEY>
Address = 10.8.1.2/32
DNS = 1.1.1.1, 1.0.0.1
MTU = 1280
Jc = <JC>
Jmin = <JMIN>
Jmax = <JMAX>
S1 = <S1>
S2 = <S2>
H1 = <H1>
H2 = <H2>
H3 = <H3>
H4 = <H4>

[Peer]
PublicKey = <SERVER_PUBLIC_KEY>
PresharedKey = <PRESHARED_KEY>
AllowedIPs = 0.0.0.0/0
Endpoint = <SERVER_IP>:<UDP_PORT>
PersistentKeepalive = 25
```

`AllowedIPs = 0.0.0.0/0` sends all IPv4 traffic through the tunnel. It does not cover IPv6.

This template configures IPv4 only, even if the VPS has public IPv6. Choose an explicit client policy:

- the client blocks IPv6 while connected; or
- the device does not use IPv6; or
- the user accepts that IPv6 remains outside the tunnel.

Do not add `::/0` if the server cannot route IPv6. That creates a broken route instead of protection.

For split routing, replace `AllowedIPs` with the requested networks and choose DNS reachable under that policy. Save the client file with permissions `0600`.

## 11. Start the service and check the server

```bash
systemctl daemon-reload
systemctl enable --now awg-quick@awg0

systemctl is-enabled awg-quick@awg0
systemctl is-active awg-quick@awg0
systemctl --no-pager --full status awg-quick@awg0

ip -brief address show awg0
ip link show awg0
ss -lunp | grep ":<UDP_PORT> "
awg show awg0

sysctl net.ipv4.ip_forward
iptables -S FORWARD
iptables -t nat -S POSTROUTING
```

Verify that:

- `awg0` has the server address;
- MTU is 1280;
- the service is active and enabled;
- the UDP port listens on `0.0.0.0`;
- `awg show` hides the private key and lists exactly the expected peers;
- forwarding is `1`;
- the active firewall permits forwarding and masquerades the VPN subnet without duplicate rules.

On an existing interface, restart only after preparing the complete configuration and checking the peer list. Verify that firewall rules are not duplicated afterward.

## 12. External verification

Import the `.conf` into a real client outside the VPS. Confirm a fresh handshake in `awg show awg0`, increasing transfer counters, successful HTTPS browsing, and the expected DNS and IPv6 behavior. For a full tunnel, check the public IPv4 from the client:

```bash
curl -4 --max-time 15 https://api.ipify.org
```

It should match the VPS's egress IPv4. For split routing, test a destination that is meant to use the tunnel. If no external client is available, report the server setup as ready with end-to-end verification pending. A local ping or listening UDP socket is not proof.

## 13. Keenetic and Netcraze

Importing a `.conf` may create a regular WireGuard interface without applying AmneziaWG parameters. In that case, set ASC through the CLI.

First find the interface's system name:

```text
show interface | grep interface-name
```

For the `Wireguard0` interface, use:

```text
interface Wireguard0 wireguard asc <JC> <JMIN> <JMAX> <S1> <S2> <H1> <H2> <H3> <H4>
system configuration save
```

Use the values from the client `.conf`. Do not substitute the profile's display name for the `WireguardN` system name.

After running the command, reconnect the interface and verify the handshake. If the CLI does not recognize `wireguard asc`, the firmware does not support it. Do not try to fix this by changing server keys.

For a full tunnel on a router, include the profile in the appropriate access policy or assign it the required priority. `AllowedIPs = 0.0.0.0/0` alone does not guarantee that home devices use this interface.

Check ASC syntax against the current [Keenetic thread](https://forum.keenetic.ru/topic/18541-advanced-security-configuration-asc-%D0%B4%D0%BB%D1%8F%C2%A0wireguard/).

## 14. File delivery and cleanup

Deliver each client file through the agreed channel with permissions `0600`. Verify transfer integrity, then remove only the temporary client files and test resources created by this setup. Clear shell variables containing keys. Retain the server configuration and protected rollback backups; do not remove unrelated files or packages.

## Common failure causes

- Client and server use different `S1`, `S2`, or `H1`...`H4` values.
- The Keenetic ASC command was not run, or it targeted the wrong `WireguardN`.
- AWG 3.x was selected, but the client supports only classic ASC parameters.
- The firewall or VPS provider's panel blocks the UDP port.
- `PostUp` names an external interface that does not exist.
- IPv4 forwarding is disabled.
- MASQUERADE is missing or uses the wrong VPN subnet.
- One client profile is active on multiple devices at once.
- The home network overlaps with the tunnel addresses.
- `awg-quick` cannot find `amneziawg-go` in systemd's PATH.

Inspect the active firewall rather than assuming iptables owns it. Start diagnosis with:

```bash
systemctl --no-pager --full status awg-quick@awg0
journalctl -u awg-quick@awg0 -n 100 --no-pager
awg show awg0
ip route
ss -lunp
iptables -S FORWARD
iptables -t nat -S POSTROUTING
```

Change one confirmed parameter at a time and repeat the handshake. Do not regenerate every key at the first error. That destroys useful evidence and makes it harder to compare client and server configurations.

## Completion report

Tell the user:

- where to download the completed `.conf`;
- the server IP and UDP port;
- the selected AWG protocol and component versions;
- whether the setup uses a kernel module or userspace;
- whether the service is active and enabled at boot;
- external handshake and Internet access test results, or pending checks;
- the IPv6 limitation if IPv6 is not configured;
- the ASC command for each Keenetic/Netcraze;
- that each additional device needs a separate profile.

Do not include private keys or preshared keys in the final text. Deliver the client `.conf` only to the user through the agreed channel.
