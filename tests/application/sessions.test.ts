import { expect, test } from 'vitest';
import { createSessionStore, type SessionSenderContext } from '../../src/application/sessions';

test('creates session with unique UUID and tabId/windowId', () => {
  const store = createSessionStore();
  const session1 = store.createSession(1, 10, 1000);
  const session2 = store.createSession(2, 10, 1000);

  expect(session1.sessionId).toBeTruthy();
  expect(session2.sessionId).toBeTruthy();
  expect(session1.sessionId).not.toBe(session2.sessionId);
  expect(session1.tabId).toBe(1);
  expect(session1.windowId).toBe(10);
  expect(session1.createdAt).toBe(1000);
  expect(session1.lastSeenAt).toBe(1000);
  expect(store.size()).toBe(2);
});

test('claimSession binds sender context on first claim', () => {
  const store = createSessionStore();
  const session = store.createSession(1, 10, 1000);
  const sender: SessionSenderContext = {
    tabId: 1,
    windowId: 10,
    frameId: 100,
    documentId: 'doc-1',
  };

  expect(store.claimSession(session.sessionId, sender, 1500)).toBe(true);
  const stored = store.getSession(session.sessionId);
  expect(stored?.claimedSender).toEqual({ frameId: 100, documentId: 'doc-1' });
  expect(stored?.lastSeenAt).toBe(1500);
});

test('claimSession accepts subsequent claim from same sender and updates lastSeenAt', () => {
  const store = createSessionStore();
  const session = store.createSession(1, 10, 1000);
  const sender: SessionSenderContext = {
    tabId: 1,
    windowId: 10,
    frameId: 100,
    documentId: 'doc-1',
  };

  expect(store.claimSession(session.sessionId, sender, 1500)).toBe(true);
  expect(store.claimSession(session.sessionId, sender, 2500)).toBe(true);
  expect(store.getSession(session.sessionId)?.lastSeenAt).toBe(2500);
});

test('claimSession rejects claim from different frameId or documentId', () => {
  const store = createSessionStore();
  const session = store.createSession(1, 10, 1000);
  const sender1: SessionSenderContext = {
    tabId: 1,
    windowId: 10,
    frameId: 100,
    documentId: 'doc-1',
  };
  const senderDifferentFrame: SessionSenderContext = {
    tabId: 1,
    windowId: 10,
    frameId: 200,
    documentId: 'doc-1',
  };
  const senderDifferentDoc: SessionSenderContext = {
    tabId: 1,
    windowId: 10,
    frameId: 100,
    documentId: 'doc-2',
  };

  expect(store.claimSession(session.sessionId, sender1, 1500)).toBe(true);
  expect(store.claimSession(session.sessionId, senderDifferentFrame, 2000)).toBe(false);
  expect(store.claimSession(session.sessionId, senderDifferentDoc, 2000)).toBe(false);
});

test('claimSession rejects claim with mismatched tabId or windowId', () => {
  const store = createSessionStore();
  const session = store.createSession(1, 10, 1000);
  const wrongTab: SessionSenderContext = {
    tabId: 2,
    windowId: 10,
    frameId: 100,
  };
  const wrongWindow: SessionSenderContext = {
    tabId: 1,
    windowId: 11,
    frameId: 100,
  };

  expect(store.claimSession(session.sessionId, wrongTab, 1500)).toBe(false);
  expect(store.claimSession(session.sessionId, wrongWindow, 1500)).toBe(false);
});

test('claimSession rejects unknown or expired session', () => {
  const store = createSessionStore(5000);
  const session = store.createSession(1, 10, 1000);
  const sender: SessionSenderContext = {
    tabId: 1,
    windowId: 10,
    frameId: 100,
  };

  expect(store.claimSession('unknown-id', sender, 1500)).toBe(false);
  expect(store.claimSession(session.sessionId, sender, 6001)).toBe(false);
  expect(store.size()).toBe(0);
});

test('validateSession requires claimed sender and validates matching sender', () => {
  const store = createSessionStore();
  const session = store.createSession(1, 10, 1000);
  const sender: SessionSenderContext = {
    tabId: 1,
    windowId: 10,
    frameId: 100,
    documentId: 'doc-1',
  };

  expect(store.validateSession(session.sessionId, sender, 1500)).toBe(false);

  store.claimSession(session.sessionId, sender, 1500);
  expect(store.validateSession(session.sessionId, sender, 2000)).toBe(true);

  const wrongSender: SessionSenderContext = {
    tabId: 1,
    windowId: 10,
    frameId: 200,
    documentId: 'doc-1',
  };
  expect(store.validateSession(session.sessionId, wrongSender, 2000)).toBe(false);

  const missingDocSender: SessionSenderContext = {
    tabId: 1,
    windowId: 10,
    frameId: 100,
  };
  expect(store.validateSession(session.sessionId, missingDocSender, 2000)).toBe(false);
});

test('validateSession enforces documentId symmetry when claimed without documentId', () => {
  const store = createSessionStore();
  const session = store.createSession(1, 10, 1000);
  const senderWithoutDoc: SessionSenderContext = {
    tabId: 1,
    windowId: 10,
    frameId: 100,
  };

  store.claimSession(session.sessionId, senderWithoutDoc, 1500);
  expect(store.validateSession(session.sessionId, senderWithoutDoc, 2000)).toBe(true);

  const senderWithUnexpectedDoc: SessionSenderContext = {
    tabId: 1,
    windowId: 10,
    frameId: 100,
    documentId: 'doc-unexpected',
  };
  expect(store.validateSession(session.sessionId, senderWithUnexpectedDoc, 2000)).toBe(false);
});

test('validateSession rejects unknown, expired, or future session', () => {
  const store = createSessionStore(5000);
  const session = store.createSession(1, 10, 1000);
  const sender: SessionSenderContext = {
    tabId: 1,
    windowId: 10,
    frameId: 100,
  };
  store.claimSession(session.sessionId, sender, 1000);

  expect(store.validateSession('unknown-id', sender, 2000)).toBe(false);
  expect(store.validateSession(session.sessionId, sender, 6001)).toBe(false);
  expect(store.size()).toBe(0);

  const futureSession = store.createSession(1, 10, 3000);
  store.claimSession(futureSession.sessionId, sender, 3000);
  expect(store.validateSession(futureSession.sessionId, sender, 2000)).toBe(false);
  expect(store.size()).toBe(0);
});

test('refreshSession updates lastSeenAt for valid session and rejects invalid', () => {
  const store = createSessionStore();
  const session = store.createSession(1, 10, 1000);
  const sender: SessionSenderContext = {
    tabId: 1,
    windowId: 10,
    frameId: 100,
  };

  expect(store.refreshSession(session.sessionId, sender, 2000)).toBe(false);

  store.claimSession(session.sessionId, sender, 1000);
  expect(store.refreshSession(session.sessionId, sender, 5000)).toBe(true);
  expect(store.getSession(session.sessionId)?.lastSeenAt).toBe(5000);

  const wrongSender: SessionSenderContext = {
    tabId: 2,
    windowId: 10,
    frameId: 100,
  };
  expect(store.refreshSession(session.sessionId, wrongSender, 6000)).toBe(false);
});

test('removeSession removes by ID without sender or with matching sender', () => {
  const store = createSessionStore();
  const session = store.createSession(1, 10, 1000);
  const sender: SessionSenderContext = {
    tabId: 1,
    windowId: 10,
    frameId: 100,
  };
  store.claimSession(session.sessionId, sender, 1000);

  const wrongSender: SessionSenderContext = {
    tabId: 2,
    windowId: 10,
    frameId: 100,
  };
  expect(store.removeSession(session.sessionId, wrongSender)).toBe(false);
  expect(store.size()).toBe(1);

  expect(store.removeSession(session.sessionId, sender)).toBe(true);
  expect(store.size()).toBe(0);

  const session2 = store.createSession(2, 10, 1000);
  expect(store.removeSession(session2.sessionId)).toBe(true);
  expect(store.size()).toBe(0);
  expect(store.removeSession('non-existent')).toBe(false);
});

test('removeTabSessions removes all sessions for given tabId', () => {
  const store = createSessionStore();
  const s1 = store.createSession(1, 10, 1000);
  const s2 = store.createSession(1, 10, 1100);
  const s3 = store.createSession(2, 10, 1200);

  const sender1: SessionSenderContext = { tabId: 1, windowId: 10, frameId: 1 };
  const sender2: SessionSenderContext = { tabId: 2, windowId: 10, frameId: 2 };
  store.claimSession(s1.sessionId, sender1, 1000);
  store.claimSession(s2.sessionId, sender1, 1100);
  store.claimSession(s3.sessionId, sender2, 1200);

  expect(store.size()).toBe(3);
  store.removeTabSessions(1);
  expect(store.size()).toBe(1);
  expect(store.validateSession(s1.sessionId, sender1, 1500)).toBe(false);
  expect(store.validateSession(s2.sessionId, sender1, 1500)).toBe(false);
  expect(store.validateSession(s3.sessionId, sender2, 1500)).toBe(true);
});

test('cleanupExpired removes only expired sessions based on timestamp', () => {
  const store = createSessionStore(5000);
  const s1 = store.createSession(1, 10, 1000);
  const s2 = store.createSession(2, 10, 4000);

  const sender1: SessionSenderContext = { tabId: 1, windowId: 10, frameId: 1 };
  const sender2: SessionSenderContext = { tabId: 2, windowId: 10, frameId: 2 };
  store.claimSession(s1.sessionId, sender1, 1000);
  store.claimSession(s2.sessionId, sender2, 4000);

  store.cleanupExpired(6500);

  expect(store.size()).toBe(1);
  expect(store.validateSession(s1.sessionId, sender1, 6500)).toBe(false);
  expect(store.validateSession(s2.sessionId, sender2, 6500)).toBe(true);
});
