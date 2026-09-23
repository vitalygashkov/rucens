import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';

/*
 * This script generates a Keenetic Web CLI REST request batch to replace current AmneziaWG connection with a new one.
 * Command example: `node ./scripts/kawg.js ./vpn-netherlands-awg.conf --old-peer-key bBiSrm6fBUjEb+2JBqS2TQOrLCYDdear8IMgVA1SQGo=`
 */

const DEFAULT_INTERFACE = 'Wireguard0';
const ASC_KEYS = [
  'jc',
  'jmin',
  'jmax',
  's1',
  's2',
  'h1',
  'h2',
  'h3',
  'h4',
  's3',
  's4',
  'i1',
  'i2',
  'i3',
  'i4',
  'i5',
];
const CORE_ASC_KEYS = ASC_KEYS.slice(0, 9);
const KNOWN_INTERFACE_KEYS = new Set([
  'address',
  'dns',
  'listenport',
  'mtu',
  'privatekey',
  ...ASC_KEYS,
]);
const KNOWN_PEER_KEYS = new Set([
  'allowedips',
  'endpoint',
  'persistentkeepalive',
  'presharedkey',
  'publickey',
]);

const usage = `Usage:
  node scripts/kawg.js target.conf [--old-peer-key KEY] [--interface Wireguard0] [--via ISP]

Print an ordered JSON batch for the Keenetic Web CLI REST tab.
The output includes the target private key. Use --old-peer-key if the remote peer key changed.
Get the current peer key from "show running-config" under the interface stanza.
`;

const fail = (message) => {
  throw new Error(message);
};

const parseArguments = (argumentsList) => {
  const positional = [];
  let interfaceName = DEFAULT_INTERFACE;
  let via = null;
  let oldPeerKey = null;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--help' || argument === '-h') return { showHelp: true };

    if (argument === '--interface' || argument === '--via' || argument === '--old-peer-key') {
      const value = argumentsList[index + 1];
      if (!value || value.startsWith('--')) fail(`Expected a value after ${argument}.`);
      if (argument === '--interface') interfaceName = value;
      else if (argument === '--via') via = value;
      else oldPeerKey = validateKey(value, 'Old peer key');
      index += 1;
      continue;
    }

    if (argument.startsWith('-')) fail(`Unknown option: ${argument}`);
    positional.push(argument);
  }

  if (positional.length !== 1) fail('Provide the new target config.');
  validateCliToken(interfaceName, 'interface name');
  if (via !== null) validateCliToken(via, 'underlay interface name');

  return { targetPath: positional[0], interfaceName, via, oldPeerKey };
};

const validateCliToken = (value, label) => {
  if (!/^[A-Za-z0-9][A-Za-z0-9_./:-]*$/.test(value)) fail(`Invalid ${label}: ${value}`);
};

const parseConfig = (text, label) => {
  const sections = { interface: [], peer: [] };
  let current = null;

  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.replace(/#.*/, '').trim();
    if (!line) continue;

    const header = line.match(/^\[([^\]]+)\]$/);
    if (header) {
      const name = header[1].trim().toLowerCase();
      if (!Object.hasOwn(sections, name)) {
        fail(`${label}:${index + 1}: unsupported section [${header[1]}].`);
      }
      current = new Map();
      sections[name].push(current);
      continue;
    }

    if (current === null) fail(`${label}:${index + 1}: expected a section header.`);
    const separator = line.indexOf('=');
    if (separator < 1) fail(`${label}:${index + 1}: expected key=value.`);

    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    const values = current.get(key) ?? [];
    values.push(value);
    current.set(key, values);
  }

  if (sections.interface.length !== 1) fail(`${label}: expected exactly one [Interface] section.`);
  if (sections.peer.length !== 1) fail(`${label}: expected exactly one [Peer] section.`);

  warnUnknownKeys(sections.interface[0], KNOWN_INTERFACE_KEYS, label);
  warnUnknownKeys(sections.peer[0], KNOWN_PEER_KEYS, label);
  return { interface: sections.interface[0], peer: sections.peer[0] };
};

const warnUnknownKeys = (section, knownKeys, label) => {
  for (const key of section.keys()) {
    if (!knownKeys.has(key))
      console.error(`Warning: ignoring unsupported setting "${key}" in ${label}.`);
  }
};

const one = (section, key, label, required = false) => {
  const values = section.get(key) ?? [];
  if (values.length > 1) fail(`${label}: ${key} must appear only once.`);
  const value = values[0]?.trim() ?? '';
  if (required && !value) fail(`${label}: missing ${key}.`);
  return value || null;
};

const list = (section, key) =>
  (section.get(key) ?? [])
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);

const validateKey = (value, label) => {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value) || Buffer.from(value, 'base64').length !== 32) {
    fail(`${label} must be a 44-character WireGuard key.`);
  }
  return value;
};

const validateCidr = (value, label) => {
  const [address, prefix, extra] = value.split('/');
  const version = isIP(address);
  const maxPrefix = version === 4 ? 32 : version === 6 ? 128 : 0;
  const prefixNumber = Number(prefix);
  if (!version || prefix === undefined || extra !== undefined)
    fail(`${label}: invalid IP/prefix "${value}".`);
  if (!Number.isInteger(prefixNumber) || prefixNumber < 0 || prefixNumber > maxPrefix) {
    fail(`${label}: invalid prefix in "${value}".`);
  }
  return { value, version };
};

const parseListOfCidrs = (section, key, label, required = false) => {
  const values = list(section, key);
  if (required && values.length === 0) fail(`${label}: missing ${key}.`);
  return values.map((value) => validateCidr(value, `${label} ${key}`));
};

const parseEndpoint = (section, label) => {
  const endpoint = one(section, 'endpoint', label);
  if (endpoint === null) return null;
  const match = endpoint.match(/^(?:\[[0-9A-Fa-f:.%]+\]|[A-Za-z0-9.-]+):(\d{1,5})$/);
  const port = match ? Number(match[1]) : 0;
  if (!match || port < 1 || port > 65535)
    fail(`${label}: Endpoint must be host:port or [IPv6]:port.`);
  return endpoint;
};

const integer = (value, label, min, max) => {
  if (!/^\d+$/.test(value)) fail(`${label} must be an integer.`);
  const number = Number(value);
  if (number < min || number > max) fail(`${label} must be between ${min} and ${max}.`);
  return number;
};

const optionalInteger = (section, key, label, min, max) => {
  const value = one(section, key, label);
  return value === null ? null : integer(value, `${label} ${key}`, min, max);
};

const parseAsc = (section, label) => {
  const values = ASC_KEYS.map((key) => one(section, key, label));
  if (values.every((value) => value === null)) return null;

  for (const key of CORE_ASC_KEYS) {
    if (one(section, key, label) === null)
      fail(`${label}: AmneziaWG ASC is incomplete; missing ${key}.`);
  }

  let optionalFieldMissing = false;
  for (const key of ASC_KEYS.slice(CORE_ASC_KEYS.length)) {
    if (one(section, key, label) === null) optionalFieldMissing = true;
    else if (optionalFieldMissing)
      fail(`${label}: optional ASC fields must be contiguous from S3.`);
  }

  return values.map((value, index) => {
    if (value === null) return null;
    if (!/^[A-Za-z0-9_./:+-]+$/.test(value))
      fail(`${label}: invalid ASC value for ${ASC_KEYS[index]}.`);
    return value;
  });
};

const parseProfile = (path) => {
  const { interface: iface, peer } = parseConfig(readFileSync(path, 'utf8'), path);
  const privateKey = one(iface, 'privatekey', path, true);
  const publicKey = one(peer, 'publickey', path, true);
  const presharedKey = one(peer, 'presharedkey', path);
  const persistentKeepalive = one(peer, 'persistentkeepalive', path);
  const addresses = parseListOfCidrs(iface, 'address', path, true);
  const dns = list(iface, 'dns');

  if (privateKey !== null) validateKey(privateKey, `${path} PrivateKey`);
  validateKey(publicKey, `${path} Peer PublicKey`);
  if (presharedKey !== null) validateKey(presharedKey, `${path} PresharedKey`);
  for (const address of dns) {
    if (!isIP(address)) fail(`${path}: DNS must contain IP addresses; got "${address}".`);
  }

  let keepalive = null;
  if (persistentKeepalive !== null && persistentKeepalive !== '0') {
    keepalive = integer(persistentKeepalive, `${path} PersistentKeepalive`, 3, 3600);
  }

  return {
    privateKey,
    addresses,
    dns,
    mtu: optionalInteger(iface, 'mtu', path, 64, 65535),
    listenPort: optionalInteger(iface, 'listenport', path, 1, 65535),
    asc: parseAsc(iface, path),
    peer: {
      publicKey,
      endpoint: parseEndpoint(peer, path),
      allowedIps: parseListOfCidrs(peer, 'allowedips', path),
      presharedKey,
      keepalive,
    },
  };
};

const dnsCommand = (address, interfaceName) => {
  const command = isIP(address) === 6 ? 'ipv6 name-server' : 'ip name-server';
  return `${command} ${address} "" on ${interfaceName}`;
};

const buildRciCommands = (target, interfaceName, via, oldPeerKey) => {
  const commands = target.dns.map((address) => dnsCommand(address, interfaceName));
  const inInterface = (command) => `interface ${interfaceName} ${command}`;
  const inPeer = (command) => inInterface(`wireguard peer ${target.peer.publicKey} ${command}`);
  const targetIpv4 = target.addresses.filter(({ version }) => version === 4);
  const targetIpv6 = target.addresses.filter(({ version }) => version === 6);

  if (targetIpv4.length > 1) fail('Keenetic accepts one IPv4 address per interface.');

  commands.push(inInterface('no ip address'));
  if (targetIpv4[0]) commands.push(inInterface(`ip address ${targetIpv4[0].value}`));
  commands.push(inInterface('no ipv6 address'));
  for (const address of targetIpv6) {
    commands.push(inInterface(`ipv6 address ${address.value}`));
  }

  commands.push(inInterface(`wireguard private-key ${target.privateKey}`));
  commands.push(
    target.listenPort === null
      ? inInterface('no wireguard listen-port')
      : inInterface(`wireguard listen-port ${target.listenPort}`),
  );
  commands.push(
    target.mtu === null ? inInterface('no ip mtu') : inInterface(`ip mtu ${target.mtu}`),
  );

  if (oldPeerKey !== null && oldPeerKey !== target.peer.publicKey) {
    commands.push(inInterface(`no wireguard peer ${oldPeerKey}`));
  }

  commands.push(inInterface(`wireguard peer ${target.peer.publicKey}`));
  commands.push(
    target.peer.endpoint === null
      ? inPeer('no endpoint')
      : inPeer(`endpoint ${target.peer.endpoint}`),
  );
  commands.push(inPeer('no allow-ips'));
  for (const allowedIp of target.peer.allowedIps) {
    commands.push(inPeer(`allow-ips ${allowedIp.value}`));
  }
  commands.push(inPeer('no preshared-key'));
  if (target.peer.presharedKey !== null) {
    commands.push(inPeer(`preshared-key ${target.peer.presharedKey}`));
  }
  commands.push(inPeer('no keepalive-interval'));
  if (target.peer.keepalive !== null) {
    commands.push(inPeer(`keepalive-interval ${target.peer.keepalive}`));
  }
  if (via !== null) commands.push(inPeer(`connect via ${via}`));
  commands.push(
    target.asc === null
      ? inInterface('no wireguard asc')
      : inInterface(`wireguard asc ${target.asc.filter((value) => value !== null).join(' ')}`),
  );
  commands.push(inInterface('up'));
  commands.push('system configuration save');

  return commands;
};

const main = () => {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.showHelp) {
      process.stdout.write(usage);
      return;
    }

    const target = parseProfile(options.targetPath);
    if (options.oldPeerKey === null) {
      console.error(
        'Note: if the remote peer key changed, pass --old-peer-key with the current key to remove it.',
      );
    }
    if (
      options.oldPeerKey !== null &&
      options.oldPeerKey !== target.peer.publicKey &&
      options.via === null
    ) {
      console.error(
        'Note: if the old peer used “connect via”, pass --via <interface> for the replacement peer.',
      );
    }
    console.error(
      'Note: existing interface-specific DNS entries cannot be inferred or removed without the old config.',
    );
    if (target.dns.length > 0) {
      console.error('Note: target DNS servers are added to the interface.');
    }
    console.error(
      'Note: the target private key determines the client public key; the VPN provider must accept it.',
    );
    console.info(
      '\nGo to http://192.168.1.1/webcli/rest (REST → POST → rci/ → Data) and paste the following JSON batch: \n',
    );
    const batch = buildRciCommands(target, options.interfaceName, options.via, options.oldPeerKey);
    const payload = batch.map((command) => ({ parse: command }));
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error('Run with --help for usage.');
    process.exitCode = 1;
  }
};

main();
