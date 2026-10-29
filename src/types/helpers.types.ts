export type Brand<T, B extends string> = T & {
  readonly _: B;
};
