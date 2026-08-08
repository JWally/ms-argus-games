import assert from 'node:assert/strict';
import test from 'node:test';
import {
  connectionLabel,
  isProxyConnection,
  isProxyProjection,
  locationLabel,
  providerLabel,
  signalLabels,
  type ProxyProjection,
} from '../src/games/proxy-or-not/engine';

function projection(overrides: Partial<ProxyProjection> = {}): ProxyProjection {
  return {
    schema_version: '2026-06-01',
    product: 'proxy_v1',
    session_id: 'session-1',
    created_at: 1,
    ttl: 2,
    network_tampering: 0,
    verdict: 'clean',
    identification: { client_uuid: null, network_id: null, network_id_source: 'none' },
    ip: '203.0.113.1',
    ipLocation: { city: null, country: 'US', latitude: null, longitude: null, timezone: null },
    ipInfo: {
      asn: {
        number: 64512,
        organization: 'Example ISP',
        category: 'residential',
        network_class: 'residential',
        metadata: null,
      },
      datacenter: { result: false },
      mobile: { result: false },
      residential: { result: true },
      vpn: { result: false },
      hosting: { result: false },
      privacy_relay: { result: false },
      corporate_shield: { result: false },
    },
    tags: [],
    ip_velocity_1h: null,
    ...overrides,
  };
}

test('classifies explicit proxy-like merchant signals', () => {
  assert.equal(isProxyConnection(projection({ tags: ['vpn'] })), true);
  assert.equal(isProxyConnection(projection({ tags: ['privacy_relay'] })), true);
  assert.equal(
    isProxyConnection(
      projection({ ipInfo: { ...projection().ipInfo, hosting: { result: true } } })
    ),
    true
  );
});

test('does not call datacenter or no-webrtc alone a proxy', () => {
  const value = projection({
    tags: ['hyperscaler', 'no_webrtc'],
    ipInfo: { ...projection().ipInfo, datacenter: { result: true } },
  });
  assert.equal(isProxyConnection(value), false);
});

test('uses the projection taxonomy for the reveal label', () => {
  assert.equal(connectionLabel(projection()), 'RESIDENTIAL');
  assert.equal(connectionLabel(projection({ tags: ['proxy'] })), 'RESIDENTIAL');
});

test('turns raw tags into cautious user-facing observations', () => {
  assert.deepEqual(signalLabels(projection({ tags: ['vpn', 'privacy_relay', 'no_webrtc'] })), [
    'VPN-like routing',
    'privacy relay range',
    'WebRTC unavailable',
  ]);
});

test('formats the merchant-safe network context', () => {
  const value = projection({
    ipLocation: {
      city: 'Chicago',
      country: 'US',
      latitude: null,
      longitude: null,
      timezone: 'America/Chicago',
    },
  });
  assert.equal(providerLabel(value), 'Example ISP · AS64512');
  assert.equal(locationLabel(value), 'Chicago, US');
});

test('rejects a full or malformed merchant response', () => {
  assert.equal(isProxyProjection({ product: 'standard', session_id: 'x' }), false);
  assert.equal(isProxyProjection({ product: 'proxy_v1', session_id: 'x' }), false);
  assert.equal(isProxyProjection(projection()), true);
});
