import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  UnprocessableEntityException,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { normalizeHttpBody } from './utils';

@Catch(UnprocessableEntityException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: UnprocessableEntityException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const status = exception.getStatus();
    const body = normalizeHttpBody(exception, request.url);
    response.status(status).send(body);
  }
}
