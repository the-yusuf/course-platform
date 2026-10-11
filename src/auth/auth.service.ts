import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { hash, verify } from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AccessTokenPayload } from './auth.types.js';
import { Database } from '../database/database.js';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_GRACE_MS = 10_000;

@Injectable()
export class AuthService {
  // verified against when the username doesn't exist, so both cases take as long
  private dummyHash?: Promise<string>;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwt: JwtService,
    private readonly db: Database,
  ) {}

  async login(dto: LoginDto) {
    const found = await this.usersService.findByUsername(dto.username);
    if (!found) {
      this.dummyHash ??= hash(randomBytes(16).toString('hex'));
      await verify(await this.dummyHash, dto.password);
      throw new UnauthorizedException('Invalid username or password');
    }
    if (!(await verify(found.password_hash, dto.password))) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const { password_hash: _passwordHash, ...user } = found;
    const tokens = await this.startSession(user.id);
    return { user: this.usersService.present(user), ...tokens };
  }

  /**
   * Rotates the refresh token. Each step is a single conditional UPDATE, so two
   * requests racing with the same token can't both rotate it.
   */
  async refresh(refreshToken: string) {
    const { sessionId, tokenHash } = this.parseRefreshToken(refreshToken);
    const newSecret = this.randomSecret();
    const now = new Date();
    const renewed = {
      refresh_token_hash: this.hash(newSecret),
      expires_at: new Date(now.getTime() + REFRESH_TTL_MS),
    };

    // normal case: the current token; it becomes the "previous" one
    let session = await this.db
      .updateTable('sessions')
      .set({
        ...renewed,
        previous_refresh_token_hash: tokenHash,
        rotated_at: now,
      })
      .where('id', '=', sessionId)
      .where('refresh_token_hash', '=', tokenHash)
      .where('expires_at', '>', now)
      .returning(['id', 'user_id'])
      .executeTakeFirst();

    // grace window: the token rotated out moments ago, e.g. a second tab
    // refreshing in parallel. Rotate again instead of treating it as theft.
    session ??= await this.db
      .updateTable('sessions')
      .set(renewed)
      .where('id', '=', sessionId)
      .where('previous_refresh_token_hash', '=', tokenHash)
      .where('rotated_at', '>', new Date(now.getTime() - REFRESH_GRACE_MS))
      .where('expires_at', '>', now)
      .returning(['id', 'user_id'])
      .executeTakeFirst();

    if (!session) {
      const existing = await this.db
        .selectFrom('sessions')
        .select('expires_at')
        .where('id', '=', sessionId)
        .executeTakeFirst();
      if (!existing) throw new UnauthorizedException('Session ended');
      if (existing.expires_at <= now)
        throw new UnauthorizedException('Session expired');

      // an old token was reused: it may have been stolen, so end the session
      await this.db
        .deleteFrom('sessions')
        .where('id', '=', sessionId)
        .execute();
      throw new UnauthorizedException('Session ended');
    }

    return {
      access_token: await this.signAccessToken(session.user_id, session.id),
      refresh_token: `${session.id}.${newSecret}`,
    };
  }

  /** Works with the refresh token alone, so it still works after the access token expired */
  async logout(refreshToken: string) {
    const { sessionId, tokenHash } = this.parseRefreshToken(refreshToken);
    const result = await this.db
      .deleteFrom('sessions')
      .where('id', '=', sessionId)
      .where((eb) =>
        eb.or([
          eb('refresh_token_hash', '=', tokenHash),
          eb('previous_refresh_token_hash', '=', tokenHash),
        ]),
      )
      .executeTakeFirst();
    if (result.numDeletedRows === 0n)
      throw new UnauthorizedException('Invalid refresh token');
  }

  /** Ends the old session and returns a fresh one, so the caller stays logged in */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (!(await this.usersService.verifyPassword(userId, dto.current_password)))
      throw new BadRequestException('Current password is incorrect');
    const user = await this.usersService.setPassword(userId, dto.new_password);
    return { user, ...(await this.startSession(userId)) };
  }

  private parseRefreshToken(refreshToken: string) {
    const [sessionId, secret] = refreshToken.split('.');
    if (!sessionId || !secret || !isUUID(sessionId))
      throw new UnauthorizedException('Invalid refresh token');
    // comparing in SQL is fine: these are hashes of 256-bit random secrets
    return { sessionId, tokenHash: this.hash(secret) };
  }

  private async startSession(userId: string) {
    const sessionId = randomUUID(); // the session id is created here
    const secret = this.randomSecret();
    const values = {
      id: sessionId,
      refresh_token_hash: this.hash(secret),
      previous_refresh_token_hash: null,
      rotated_at: null,
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
}
