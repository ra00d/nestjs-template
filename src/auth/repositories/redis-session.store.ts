import { Inject, Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type SessionRecord,
  type SessionStore,
} from '@nestjs/authentication';
import type { RedisStore } from '../../redis/redis.options';
import { REDIS_STORE } from '../../redis/redis.constants';

const SESSION_KEY = 'session:';
const USER_SESSIONS_KEY = 'user-sessions:';

/**
 * Keeps sessions in Redis, through the shared `KeyvRedis` adapter.
 * `session:<id>` holds the record, with the session's absolute expiry as its
 * TTL; `user-sessions:<userId>` keeps the ids of a user's sessions for
 * `listUserSessions()` and `deleteUserSessions()`. `deleteSession()` is one
 * Redis `DEL`, so of a rotation and a sign-out, only one wins.
 */
@Injectable()
export class RedisSessionStore implements SessionStore {
  constructor(
    @Inject(REDIS_STORE) private readonly redis: RedisStore,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({
      sessions: this,
    });
  }

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const raw = await this.redis.get<string>(this.sessionKey(id));
    return raw ? this.parse(raw) : undefined;
  }

  async createSession(record: SessionRecord): Promise<void> {
    if (record.expiresAt.getTime() <= Date.now()) {
      return; // Already past its absolute expiry: nothing to store.
    }
    await this.redis.set(
      this.sessionKey(record.id),
      JSON.stringify(record),
      record.expiresAt.getTime(), // KeyvRedis takes an absolute Unix ms expiry.
    );
    await this.indexAdd(record.userId, record.id);
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    // Conditional: a session deleted by a sign-out is not brought back, and
    // time only moves forward. The TTL keeps the original absolute expiry.
    const session = await this.getSession(id);
    if (!session || session.lastActiveAt >= lastActiveAt) {
      return;
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      return;
    }
    await this.redis.set(
      this.sessionKey(id),
      JSON.stringify({ ...session, lastActiveAt }),
      session.expiresAt.getTime(), // Keep the original absolute expiry.
    );
  }

  // Whether this call deleted it: of two rotations of a session, or a rotation and a sign-out, one wins.
  async deleteSession(id: string): Promise<boolean> {
    const session = await this.getSession(id);
    const deleted = await this.redis.delete(this.sessionKey(id));
    if (deleted && session) {
      await this.indexRemove(session.userId, id);
    }
    return deleted;
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    const ids = await this.readIndex(userId);
    const sessions = await Promise.all(ids.map((id) => this.getSession(id)));
    const live = sessions.filter(
      (session): session is SessionRecord => Boolean(session),
    );
    if (live.length !== ids.length) {
      // Drop the ids whose session expired: the index stays bounded.
      await this.writeIndex(
        userId,
        live.map((session) => session.id),
      );
    }
    return live;
  }

  async deleteUserSessions(userId: string): Promise<void> {
    const ids = await this.readIndex(userId);
    await Promise.all(ids.map((id) => this.redis.delete(this.sessionKey(id))));
    await this.redis.delete(this.indexKey(userId));
  }

  private sessionKey(id: string): string {
    return `${SESSION_KEY}${id}`;
  }

  private indexKey(userId: string): string {
    return `${USER_SESSIONS_KEY}${userId}`;
  }

  /** The user's session ids: `[]` when nothing is indexed yet. */
  private async readIndex(userId: string): Promise<string[]> {
    const raw = await this.redis.get<string>(this.indexKey(userId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  }

  private async writeIndex(userId: string, ids: string[]): Promise<void> {
    await this.redis.set(this.indexKey(userId), JSON.stringify(ids));
  }

  private async indexAdd(userId: string, id: string): Promise<void> {
    const ids = await this.readIndex(userId);
    await this.writeIndex(userId, [...ids, id]);
  }

  private async indexRemove(userId: string, id: string): Promise<void> {
    const ids = await this.readIndex(userId);
    await this.writeIndex(
      userId,
      ids.filter((sessionId) => sessionId !== id),
    );
  }

  /** The stored string as a record: JSON turned the dates into ISO strings. */
  private parse(raw: string): SessionRecord {
    const record = JSON.parse(raw) as SessionRecord;
    return {
      ...record,
      createdAt: new Date(record.createdAt),
      expiresAt: new Date(record.expiresAt),
      lastActiveAt: new Date(record.lastActiveAt),
    };
  }
}
