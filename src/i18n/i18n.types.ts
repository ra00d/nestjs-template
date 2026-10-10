/**
 * The shape of the catalogs in `src/i18n/<locale>/*.json`. Each file is a
 * namespace named after the file (`en/auth.json` -> `auth.*`).
 *
 * Keep this in sync with the JSON files: `I18nService.t()`, `t()` and
 * `i18nIssueMessage()` type-check their keys against it.
 */
export interface Translations {
  common: {
    hello: string;
  };
  auth: {
    invalidCredentials: string;
    emailAlreadyRegistered: string;
    invalidPassword: string;
  };
  mail: {
    verifyEmail: {
      subject: string;
    };
    passwordReset: {
      subject: string;
    };
    magicLink: {
      subject: string;
    };
  };
  validation: {
    invalid_type: string;
    too_small: string;
    too_big: string;
    invalid_format: string;
    unrecognized_keys: string;
    invalid_union: string;
    custom: string;
    invalidEmail: string;
  };
}

declare module '@nestjs/i18n' {
  interface I18nTypes {
    translations: Translations;
  }
}
