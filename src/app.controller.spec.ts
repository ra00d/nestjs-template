import { Test, TestingModule } from '@nestjs/testing';
import { I18nModule, InMemoryI18nLoader } from '@nestjs/i18n';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [
        I18nModule.forRoot({
          loader: new InMemoryI18nLoader({
            en: { common: { hello: 'Hello World!' } },
          }),
        }),
      ],
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
