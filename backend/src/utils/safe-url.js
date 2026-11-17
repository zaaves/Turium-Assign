import dns from 'node:dns/promises';
import { URL } from 'node:url';
import net from 'node:net';

/**
 * Checks if an IPv4 or IPv6 address belongs to a private, loopback, link-local,
 * carrier-grade NAT, or otherwise reserved IP range.
 */
export function isPrivateIp(ip) {
  const version = net.isIP(ip);
  if (!version) return true; // Not a valid IP -> consider unsafe

  if (version === 4) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true;
    }

    const [a, b] = parts;

    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;

    // 10.0.0.0/8 (Private)
    if (a === 10) return true;

    // 100.64.0.0/10 (Carrier-grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;

    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;

    // 169.254.0.0/16 (Link-local / Cloud metadata service 169.254.169.254)
    if (a === 169 && parts[1] === 254) return true;

    // 172.16.0.0/12 (Private)
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (a === 192 && b === 0 && parts[2] === 0) return true;

    // 192.0.2.0/24 (Documentation / TEST-NET-1)
    if (a === 192 && b === 0 && parts[2] === 2) return true;

    // 192.168.0.0/16 (Private)
    if (a === 192 && b === 168) return true;

    // 198.18.0.0/15 (Network benchmark tests)
    if (a === 198 && (b === 18 || b === 19)) return true;

    // 198.51.100.0/24 (Documentation / TEST-NET-2)
    if (a === 198 && b === 51 && parts[2] === 100) return true;

    // 203.0.113.0/24 (Documentation / TEST-NET-3)
    if (a === 203 && b === 0 && parts[2] === 113) return true;

    // 224.0.0.0/4 (Multicast)
    if (a >= 224 && a <= 239) return true;

    // 240.0.0.0/4 (Reserved / Future use)
    if (a >= 240) return true;

    // 255.255.255.255 (Broadcast)
    if (parts.every((p) => p === 255)) return true;

    return false;
  }

  if (version === 6) {
    const normalized = ip.toLowerCase();

    // Loopback ::1
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;

    // Unspecified ::
    if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

    // IPv4-mapped IPv6 (::ffff:x.x.x.x)
    if (normalized.startsWith('::ffff:')) {
      const v4Part = normalized.replace('::ffff:', '');
      return isPrivateIp(v4Part);
    }

    // Unique Local Address (ULA) fc00::/7 (fc00:: - fdff::)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

    // Link-Local Unicast fe80::/10 (fe80:: - febf::)
    if (
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    ) {
      return true;
    }

    return false;
  }

  return true;
}

/**
 * Validates a URL string for HTTP/HTTPS protocol, syntax, and ensures destination
 * hostname does not resolve to private/loopback/cloud metadata IP ranges.
 */
export async function validateAndResolveUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch (_err) {
    throw new Error('Invalid URL format.');
  }

  // Only http and https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported URL protocol '${parsed.protocol}'. Only http and https are allowed.`);
  }

  // Reject credentials in URL
  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed.');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Explicit check for localhost and dotless hostnames
  if (hostname === 'localhost' || !hostname.includes('.')) {
    throw new Error(`Access to local or dotless host '${hostname}' is prohibited.`);
  }

  // If hostname is already an IP address
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error(`Access to private/loopback IP address '${hostname}' is prohibited.`);
    }
    return {
      valid: true,
      url: parsed,
      resolvedIps: [hostname],
    };
  }

  // Resolve hostname via DNS
  let records;
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch (err) {
    throw new Error(`DNS resolution failed for host '${hostname}': ${err.message}`);
  }

  if (!records || records.length === 0) {
    throw new Error(`No DNS records found for host '${hostname}'.`);
  }

  const resolvedIps = records.map((r) => r.address);

  // Check all resolved IPs
  for (const record of records) {
    if (isPrivateIp(record.address)) {
      throw new Error(
        `Host '${hostname}' resolved to private/restricted IP '${record.address}', which is prohibited.`
      );
    }
  }

  return {
    valid: true,
    url: parsed,
    resolvedIps,
  };
}
