import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NodeRequest } from '@nestjs/platform-node';
import { Observable } from 'rxjs';
import { WithCache } from './cache.decorator';
import { CacheService } from './cache.service';

@Injectable()
export class UnCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly cache: CacheService,
  ) {}
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const method = context.getHandler();
    const req = context.switchToHttp().getRequest<NodeRequest>();
    const cachKey = this.reflector.get(WithCache, method);
    // Ensure we're not creating a new object for the same request
    // if (cachKey && cachKey !== '{}') {
    //   throw new Error(
    //     `The interceptor is only intended to handle one request per key.`,
    //   );
    // }

    let queryParamsStr = 'query:';
    const parsedQueryParams: URLSearchParams = new URLSearchParams(req.query);

    for (const [key, value] of parsedQueryParams.entries()) {
      queryParamsStr += `${key}-${value}`;
    }
    //
    let urlParamsStr = 'params:';
    let queryPairs: any = Object.entries(req.params);

    for (const [key, val] of queryPairs) {
      urlParamsStr += `${key}-${val}`;
    }
    const key = cachKey + urlParamsStr + queryParamsStr;
    await this.cache.delete(key);
    return next.handle();
  }
}
