import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { InMemoryMailTransport, MailTransport } from '@nestjs/mail';
import request, { type Response } from 'supertest';
import { AppModule } from './../src/app.module.js';
import { MagicLinkMail } from './../src/auth/magic-link.mailer.js';

// Each run signs in through addresses of its own, so the accounts a previous run
// left in the database are never the ones these tests find.
const address = (label: string) => `${label}-${crypto.randomUUID()}@example.com`;

describe('Magic-link sign-in (e2e)', () => {
  let app: INestApplication;
  let base: string;
  let mailbox: InMemoryMailTransport;

  beforeEach(async () => {
    mailbox = new InMemoryMailTransport();
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      // Reads the link out of the mailbox, where no SMTP server is needed.
      .overrideProvider(MailTransport)
      .useValue(mailbox)
      .compile();

    app = moduleFixture.createNestApplication(new FastifyAdapter());
    // `listen()` calls `fastify.ready()` — without it the route contexts lack
    // their hook lists and requests crash in fastify's preParsing runner.
    await app.listen(0);
    const server = app.getHttpServer() as { address: () => { port: number } };
    base = `http://127.0.0.1:${server.address().port}`;
    mailbox.clear();
  });

  afterEach(async () => {
    await app.close();
  });

  /**
   * A browser's cookie jar, which a magic link and the session it opens both
   * need: one of these per browser, which is what `request.agent()` is for. The
   * jar is carried by hand because supertest's own drops the `Secure` cookies
   * the application sets, which a browser accepts over plain HTTP on localhost.
   */
  const browser = () => {
    const jar = new Map<string, string>();
    const call = async (method: 'get' | 'post', path: string, body?: Record<string, string>): Promise<Response> => {
      const pending = request(base)[method](path);
      const cookies = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
      if (cookies) {
        pending.set('Cookie', cookies);
      }
      const res = await (body === undefined ? pending : pending.send(body));
      for (const header of res.headers['set-cookie'] ?? []) {
        const [pair] = header.split(';');
        const separator = pair.indexOf('=');
        jar.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
      return res;
    };
    return {
      get: (path: string) => call('get', path),
      post: (path: string, body?: Record<string, string>) => call('post', path, body),
    };
  };

  /** The token the emailed link carries, which the page the link opens POSTs back. */
  const tokenFrom = (email: string): string => {
    const token = mailbox.assertSent({ to: email, mail: MagicLinkMail }).link('/magic-link').searchParams.get('token');
    expect(token).toBeTruthy();
    return token as string;
  };

  it('signs a new address in, creating a verified account', async () => {
    const email = address('new');
    const customer = browser();

    expect((await customer.post('/auth/magic-link/request', { email })).status).toBe(202);

    // The link proves the address, so the account it opens is verified: the
    // session works right away, with no second step.
    const verified = await customer.post('/auth/magic-link/verify', { token: tokenFrom(email) });
    expect(verified.status).toBe(200);
    expect(verified.body).toEqual({ mfaRequired: false });

    const me = await customer.get('/me');
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email, emailVerified: true, roles: ['customer'] });
  });

  it('signs an existing account in, without a password', async () => {
    const email = address('existing');
    expect((await request(base).post('/auth/sign-up').send({ email, password: 'a-long-enough-password' })).status).toBe(201);

    const customer = browser();
    expect((await customer.post('/auth/magic-link/request', { email })).status).toBe(202);
    // The link verifies the address a password sign-up left unverified.
    expect((await customer.post('/auth/magic-link/verify', { token: tokenFrom(email) })).status).toBe(200);

    const me = await customer.get('/me');
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email, emailVerified: true });
  });

  it('spends a link once, and refuses it afterwards', async () => {
    const email = address('once');
    const customer = browser();
    await customer.post('/auth/magic-link/request', { email });
    const token = tokenFrom(email);

    expect((await customer.post('/auth/magic-link/verify', { token })).status).toBe(200);
    // The link is gone from the store, and with it the browser's transaction
    // cookie, so a second attempt is told the link is not this browser's:
    // either way, nobody is signed in twice.
    expect((await customer.post('/auth/magic-link/verify', { token })).status).toBe(401);
  });

  it('refuses a link opened in another browser', async () => {
    const email = address('elsewhere');
    const asked = browser();
    expect((await asked.post('/auth/magic-link/request', { email })).status).toBe(202);

    // No cookie from the request, so the link is not this browser's to use: the
    // package's own 401, which tells the customer where to open it.
    const refused = await browser().post('/auth/magic-link/verify', { token: tokenFrom(email) });
    expect(refused.status).toBe(401);
    expect(refused.body.error).toBe('not_this_browser');
  });

  it('answers the same for an address with no account', async () => {
    const email = address('unknown');
    expect((await browser().post('/auth/magic-link/request', { email })).status).toBe(202);
    expect(mailbox.assertSent({ to: email }).subject).toBe('Your sign-in link');
  });

  it('sends nothing for an address no mail should go to', async () => {
    expect((await browser().post('/auth/magic-link/request', { email: 'not-an-address' })).status).toBe(400);
    expect(mailbox.mails).toHaveLength(0);
  });
});