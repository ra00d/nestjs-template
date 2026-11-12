import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CacheInterceptor } from './cache.interceptor';
import { UnCacheInterceptor } from './uncache.interceptor';

export const WithCache = Reflector.createDecorator<string>();

export const Cachable = (key: string) => {
  return applyDecorators(WithCache(key), UseInterceptors(CacheInterceptor));
};

export const UnCache = (key: string) => {
  return applyDecorators(WithCache(key), UseInterceptors(UnCacheInterceptor));
};
