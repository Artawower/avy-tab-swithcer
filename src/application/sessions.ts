export interface SessionSenderContext {
  readonly tabId: number;
  readonly windowId: number;
  readonly frameId: number;
  readonly documentId?: string | undefined;
}

export interface SwitcherSession {
  readonly sessionId: string;
  readonly tabId: number;
  readonly windowId: number;
  readonly createdAt: number;
  lastSeenAt: number;
  claimedSender?: {
    readonly frameId: number;
    readonly documentId?: string | undefined;
  };
}

const SESSION_TTL_MS = 60_000;

export interface SessionStore {
  createSession: (tabId: number, windowId: number, now?: number) => SwitcherSession;
  claimSession: (sessionId: string, sender: SessionSenderContext, now?: number) => boolean;
  validateSession: (sessionId: string, sender: SessionSenderContext, now?: number) => boolean;
  refreshSession: (sessionId: string, sender: SessionSenderContext, now?: number) => boolean;
  removeSession: (sessionId: string, sender?: SessionSenderContext) => boolean;
  removeTabSessions: (tabId: number) => void;
  cleanupExpired: (now?: number) => void;
  getSession: (sessionId: string) => SwitcherSession | undefined;
  size: () => number;
}

export function createSessionStore(ttlMs = SESSION_TTL_MS): SessionStore {
  const sessions = new Map<string, SwitcherSession>();

  const isExpired = (session: SwitcherSession, now: number): boolean => {
    return now - session.lastSeenAt > ttlMs || now < session.lastSeenAt;
  };

  const senderMatches = (
    claimed: { readonly frameId: number; readonly documentId?: string | undefined },
    sender: SessionSenderContext,
  ): boolean => {
    if (claimed.frameId !== sender.frameId) {
      return false;
    }
    if (claimed.documentId !== sender.documentId) {
      return false;
    }
    return true;
  };

  const getLiveSessionForTab = (
    sessionId: string,
    sender: SessionSenderContext,
    now: number,
  ): SwitcherSession | null => {
    const session = sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (isExpired(session, now)) {
      sessions.delete(sessionId);
      return null;
    }

    if (session.tabId !== sender.tabId || session.windowId !== sender.windowId) {
      return null;
    }

    return session;
  };

  return {
    createSession(tabId: number, windowId: number, now = Date.now()): SwitcherSession {
      const sessionId = crypto.randomUUID();
      const session: SwitcherSession = {
        sessionId,
        tabId,
        windowId,
        createdAt: now,
        lastSeenAt: now,
      };
      sessions.set(sessionId, session);
      return session;
    },

    claimSession(sessionId: string, sender: SessionSenderContext, now = Date.now()): boolean {
      const session = getLiveSessionForTab(sessionId, sender, now);
      if (!session) {
        return false;
      }

      if (session.claimedSender) {
        if (!senderMatches(session.claimedSender, sender)) {
          return false;
        }
        session.lastSeenAt = now;
        return true;
      }

      session.claimedSender = {
        frameId: sender.frameId,
        ...(sender.documentId ? { documentId: sender.documentId } : {}),
      };
      session.lastSeenAt = now;
      return true;
    },

    validateSession(sessionId: string, sender: SessionSenderContext, now = Date.now()): boolean {
      const session = getLiveSessionForTab(sessionId, sender, now);
      if (!session || !session.claimedSender) {
        return false;
      }

      return senderMatches(session.claimedSender, sender);
    },

    refreshSession(sessionId: string, sender: SessionSenderContext, now = Date.now()): boolean {
      const session = getLiveSessionForTab(sessionId, sender, now);
      if (!session || !session.claimedSender || !senderMatches(session.claimedSender, sender)) {
        return false;
      }

      session.lastSeenAt = now;
      return true;
    },

    removeSession(sessionId: string, sender?: SessionSenderContext): boolean {
      const session = sessions.get(sessionId);
      if (!session) {
        return false;
      }

      if (sender) {
        if (session.tabId !== sender.tabId || session.windowId !== sender.windowId) {
          return false;
        }
        if (session.claimedSender && !senderMatches(session.claimedSender, sender)) {
          return false;
        }
      }

      sessions.delete(sessionId);
      return true;
    },

    removeTabSessions(tabId: number): void {
      for (const [id, session] of sessions.entries()) {
        if (session.tabId === tabId) {
          sessions.delete(id);
        }
      }
    },

    cleanupExpired(now = Date.now()): void {
      for (const [id, session] of sessions.entries()) {
        if (isExpired(session, now)) {
          sessions.delete(id);
        }
      }
    },

    getSession(sessionId: string): SwitcherSession | undefined {
      return sessions.get(sessionId);
    },

    size(): number {
      return sessions.size;
    },
  };
}
