import { describe, it, expect, vi } from 'vitest';
import dns from 'node:dns/promises';
import { isPrivateIp, validateAndResolveUrl } from '../src/utils/safe-url.js';

describe('Safe URL & SSRF Validation', () => {
  describe('isPrivateIp', () => {
    it('should identify loopback and private IPv4 ranges', () => {
      expect(isPrivateIp('127.0.0.1')).toBe(true);
      expect(isPrivateIp('127.0.1.5')).toBe(true);
      expect(isPrivateIp('10.0.0.1')).toBe(true);
      expect(isPrivateIp('10.254.254.1')).toBe(true);
      expect(isPrivateIp('172.16.0.1')).toBe(true);
      expect(isPrivateIp('172.31.255.255')).toBe(true);
      expect(isPrivateIp('192.168.1.100')).toBe(true);
      expect(isPrivateIp('169.254.169.254')).toBe(true); // AWS/Cloud metadata
      expect(isPrivateIp('0.0.0.0')).toBe(true);
      expect(isPrivateIp('255.255.255.255')).toBe(true);
    });

    it('should identify loopback and private IPv6 ranges', () => {
      expect(isPrivateIp('::1')).toBe(true);
      expect(isPrivateIp('::')).toBe(true);
      expect(isPrivateIp('fe80::1')).toBe(true);
      expect(isPrivateIp('fc00::1')).toBe(true);
      expect(isPrivateIp('fd12:3456:789a::1')).toBe(true);
      expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
    });

    it('should allow public IP addresses', () => {
      expect(isPrivateIp('8.8.8.8')).toBe(false);
      expect(isPrivateIp('1.1.1.1')).toBe(false);
      expect(isPrivateIp('93.184.216.34')).toBe(false); // example.com
    });
  });

  describe('validateAndResolveUrl', () => {
    it('should allow valid public HTTP/HTTPS URLs with resolved public IP', async () => {
      vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);

      const result = await validateAndResolveUrl('https://example.com/docs');
      expect(result.valid).toBe(true);
      expect(result.url.hostname).toBe('example.com');
      expect(result.resolvedIps).toEqual(['93.184.216.34']);
    });

    it('should allow public IP address URLs without DNS lookup', async () => {
      const result = await validateAndResolveUrl('http://93.184.216.34/path');
      expect(result.valid).toBe(true);
      expect(result.resolvedIps).toEqual(['93.184.216.34']);
    });

    it('should reject URLs when resolved IP belongs to a private network', async () => {
      vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);

      await expect(validateAndResolveUrl('https://malicious-internal-domain.com')).rejects.toThrow(
        /resolved to private\/restricted IP/
      );
    });

    it('should reject non-HTTP/HTTPS protocols', async () => {
      await expect(validateAndResolveUrl('ftp://example.com/file')).rejects.toThrow(
        /Unsupported URL protocol/
      );
      await expect(validateAndResolveUrl('file:///etc/passwd')).rejects.toThrow(
        /Unsupported URL protocol/
      );
      await expect(validateAndResolveUrl('javascript:alert(1)')).rejects.toThrow(
        /Unsupported URL protocol/
      );
    });

    it('should reject localhost and dotless hosts', async () => {
      await expect(validateAndResolveUrl('http://localhost:5000')).rejects.toThrow(
        /Access to local or dotless host/
      );
      await expect(validateAndResolveUrl('http://internaladmin/dashboard')).rejects.toThrow(
        /Access to local or dotless host/
      );
    });

    it('should reject URLs with embedded credentials', async () => {
      await expect(validateAndResolveUrl('https://user:password@example.com')).rejects.toThrow(
        /credentials are not allowed/
      );
    });

    it('should reject direct private IP destinations', async () => {
      await expect(validateAndResolveUrl('http://127.0.0.1:8080/metrics')).rejects.toThrow(
        /Access to private\/loopback IP address/
      );
      await expect(validateAndResolveUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
        /Access to private\/loopback IP address/
      );
    });
  });
});
