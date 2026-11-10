import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  UnprocessableEntityException,
} from '@nestjs/common';
import { normalizeHttpBody } from './utils';
import { NodeRequest, NodeResponse } from '@nestjs/platform-node';

@Catch(UnprocessableEntityException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: UnprocessableEntityException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<NodeResponse>();
    const request = ctx.getRequest<NodeRequest>();
    const status = exception.getStatus();
    const body = normalizeHttpBody(exception, request.url!);
    response.status(status).send(body);
  }
}
