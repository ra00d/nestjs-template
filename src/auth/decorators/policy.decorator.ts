import { applyDecorators, Injectable, ScopeOptions } from '@nestjs/common';

export const Policy = (opts?: ScopeOptions) => {
  return applyDecorators(Injectable(opts));
};
