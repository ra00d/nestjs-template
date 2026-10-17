import { SetMetadata } from '@nestjs/common';

export const PUBLIC_API = Symbol('PUBLIC');

export const Public = () => {
  return SetMetadata(PUBLIC_API, true);
};
