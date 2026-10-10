import { Test, type TestingModule } from '@nestjs/testing';
import {
  I18nContext,
  I18nModule,
  I18nService,
  JsonI18nLoader,
  translateStandardSchemaIssues,
} from '@nestjs/i18n';
import { signUpSchema } from '../auth/auth.schemas.js';
import './i18n.types.js';

describe('i18n', () => {
  let moduleFixture: TestingModule;
  let i18n: I18nService;
  let context: I18nContext;

  beforeEach(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [
        I18nModule.forRoot({
          loader: new JsonI18nLoader({ path: import.meta.dirname }),
          defaultLocale: 'en',
        }),
      ],
    }).compile();
    i18n = moduleFixture.get(I18nService);
    context = moduleFixture.get(I18nContext);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('serves the catalog locales and falls back to the default locale', () => {
    expect(i18n.supportedLocales).toEqual(expect.arrayContaining(['en', 'de']));
    expect(i18n.t('common.hello')).toBe('Hello World!');
    expect(i18n.t('common.hello', { locale: 'de' })).toBe('Hallo Welt!');
    // Regional variants fall back to their base language (`de-AT` -> `de`).
    expect(i18n.matchLocale('de-AT')).toBe('de');
    expect(context.run('de', () => i18n.t('auth.invalidCredentials'))).toBe(
      'Ungültige E-Mail oder ungültiges Passwort',
    );
  });

  it('translates validation issues in the request locale', () => {
    const parsed = signUpSchema.safeParse({ email: 'not-an-email', password: 'short' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const english = context.run('en', () => translateStandardSchemaIssues(parsed.error.issues));
      const german = context.run('de', () => translateStandardSchemaIssues(parsed.error.issues));
      expect(english.map((issue) => issue.message)).toEqual([
        'Invalid email address',
        'Too small: expected at least 12',
      ]);
      expect(german.map((issue) => issue.message)).toEqual([
        'Ungültige E-Mail-Adresse',
        'Zu klein: mindestens 12 erwartet',
      ]);
    }
  });
});
