import { ParameterObject } from '@nestjs/swagger';

export const DEFAULT_PARAMETERS: Omit<
  ParameterObject,
  'example' | 'examples'
>[] = [
  {
    name: 'accept-language',
    in: 'header',
  },
];
