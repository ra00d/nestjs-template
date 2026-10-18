import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { normalizeEmail } from '../../utils/string';

/** Per IP everywhere; per (email, IP) where the request body names an account. */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip = await super.getTracker(req);
    const raw = typeof req.body?.email === 'string' ? req.body.email : '';
    const email = raw ? normalizeEmail(raw) : '';
    return email ? `${email}|${ip}` : ip;
  }
}