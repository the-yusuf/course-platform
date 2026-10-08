import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { verify } from 'argon2';
import { JwtService } from '@nestjs/jwt';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { AccessTokenPayload } from './auth.types.js';
import { Database } from '../database/database.js';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwt: JwtService,
    private readonly db: Database,
  ) {}

  async login(dto: LoginDto) {
    const found = await this.usersService.findByUsername(dto.username);
    if (!found || !(await verify(found.password_hash, dto.password))) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const { password_hash, ...user } = found;
    const tokens = await this.startSession(user.id);
    return { user: this.usersService.present(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    const [sessionId, secret] = refreshToken.split('.');
    if (!sessionId || !secret)
      throw new UnauthorizedException('Invalid refresh token');

    const session = await this.db
      .selectFrom('sessions')
      .select(['id', 'user_id', 'refresh_token_hash', 'expires_at'])
      .where('id', '=', sessionId)
      .executeTakeFirst();

    if (!session) throw new UnauthorizedException('Session ended');
    if (session.expires_at < new Date())
      throw new UnauthorizedException('Session expired');

    if (!this.hashMatches(secret, session.refresh_token_hash)) {
      // an old refresh token was reused: it may have been stolen, so end the session
      await this.db
        .deleteFrom('sessions')
        .where('id', '=', session.id)
        .execute();
      throw new UnauthorizedException('Session ended');
    }

    // rotation: new secret, same session id
    const newSecret = this.randomSecret();
    await this.db
      .updateTable('sessions')
      .set({
        refresh_token_hash: this.hash(newSecret),
        expires_at: new Date(Date.now() + REFRESH_TTL_MS),
      })
      .where('id', '=', session.id)
      .execute();

    return {
      access_token: await this.signAccessToken(session.user_id, session.id),
      refresh_token: `${session.id}.${newSecret}`,
    };
  }

  async logout(sessionId: string) {
    await this.db.deleteFrom('sessions').where('id', '=', sessionId).execute();
  }

  private async startSession(userId: string) {
    const sessionId = randomUUID(); // the session id is created here
    const secret = this.randomSecret();
    const values = {
      id: sessionId,
      refresh_token_hash: this.hash(secret),
      expires_at: new Date(Date.now() + REFRESH_TTL_MS),
    };

    // one row per user: a new login replaces the old session (logs out the other device)
    await this.db
      .insertInto('sessions')
      .values({ ...values, user_id: userId })
      .onConflict((oc) => oc.column('user_id').doUpdateSet(values))
      .execute();

    return {
      access_token: await this.signAccessToken(userId, sessionId),
      refresh_token: `${sessionId}.${secret}`,
    };
  }

  private signAccessToken(userId: string, sessionId: string) {
    const payload: AccessTokenPayload = { sub: userId, sid: sessionId };
    return this.jwt.signAsync(payload);
  }

  private randomSecret() {
    return randomBytes(32).toString('base64url');
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private hashMatches(secret: string, storedHash: string) {
    return timingSafeEqual(
      Buffer.from(this.hash(secret)),
      Buffer.from(storedHash),
    );
  }
}
