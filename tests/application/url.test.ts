import { expect, test } from 'vitest';
import { parseHostname, tryParseUrl } from '../../src/application/url';

test('tryParseUrl returns URL instance for valid URLs', () => {
  const url = tryParseUrl('https://example.com/path?foo=bar');
  expect(url).toBeInstanceOf(URL);
  expect(url?.hostname).toBe('example.com');
});

test('tryParseUrl returns null for empty, null, or undefined values', () => {
  expect(tryParseUrl('')).toBeNull();
  expect(tryParseUrl(null)).toBeNull();
  expect(tryParseUrl(undefined)).toBeNull();
});

test('tryParseUrl returns null for malformed URLs', () => {
  expect(tryParseUrl('not a valid url')).toBeNull();
  expect(tryParseUrl('http://')).toBeNull();
});

test('parseHostname returns lowercased hostname for standard URLs', () => {
  expect(parseHostname('https://EXAMPLE.COM/path')).toBe('example.com');
  expect(parseHostname('http://Sub.Domain.Net:8080/')).toBe('sub.domain.net');
});

test('parseHostname returns hostname for extension URLs', () => {
  expect(parseHostname('chrome://extensions/')).toBe('extensions');
});

test('parseHostname returns empty string for missing or non-hostname URLs', () => {
  expect(parseHostname('')).toBe('');
  expect(parseHostname(null)).toBe('');
  expect(parseHostname(undefined)).toBe('');
  expect(parseHostname('about:blank')).toBe('');
  expect(parseHostname('javascript:void(0)')).toBe('');
  expect(parseHostname('file:///path/to/file')).toBe('');
  expect(parseHostname('invalid')).toBe('');
});
