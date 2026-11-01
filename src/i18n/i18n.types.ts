import validation from './ar/validation.json';
import auth from './ar/auth.json';
import common from './ar/common.json';
import mail from './ar/mail.json';
import errors from './ar/errors.json';

/**
 * The shape of the catalogs in `src/i18n/<locale>/*.json`. Each file is a
 * namespace named after the file (`en/auth.json` -> `auth.*`).
 *
 * Keep this in sync with the JSON files: `I18nService.t()`, `t()` and
 * `i18nIssueMessage()` type-check their keys against it.
 */
export interface Translations {
  common: typeof common;
  errors: typeof errors;
  auth: typeof auth;
  mail: typeof mail;
  validation: typeof validation;
}

declare module '@nestjs/i18n' {
  interface I18nTypes {
    translations: Translations;
  }
}
