import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable, tap } from 'rxjs';
import { WithCache } from './cache.decorator';
import { NodeRequest, NodeResponse } from '@nestjs/platform-node';
import { CacheService } from './cache.service';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
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
    const data = await this.cache.get(key);
    console.log(await this.cache.keys());
    
    if (data) {
      return next.handle().pipe(map(() => data));
    }
    return next.handle().pipe(
      tap(async (data) => {
        await this.cache.set(key, data);
      }),
    );
  }
}
