import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE_RANK } from '../auth.types.js';
import type { AuthUser, Role } from '../auth.types.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true; // any logged-in user

    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    const userRank = user ? (ROLE_RANK[user.role] ?? 0) : 0;

    // allowed if the user's rank reaches at least one of the required roles
    const allowed = required.some((role) => userRank >= ROLE_RANK[role]);
    if (!allowed) {
      throw new ForbiddenException('You do not have permission to do this');
    }
    return true;
  }
}
