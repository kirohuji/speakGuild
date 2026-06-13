import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { OpsAlertService } from '../ops/ops-alert.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly alerts?: OpsAlertService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as any;
        message = Array.isArray(resp.message)
          ? resp.message.join('; ')
          : resp.message || message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception.stack,
      );
    }

    if (status >= 500) {
      void this.alerts?.notify({
        key: `http-5xx:${request.method}:${request.route?.path || request.path}`,
        title: `后端 5xx: ${request.method} ${request.originalUrl || request.url}`,
        severity: 'critical',
        details: {
          status,
          message,
          path: request.originalUrl || request.url,
          method: request.method,
          stack: exception instanceof Error ? exception.stack : undefined,
        },
      });
    }

    response.status(status).json({
      code: status,
      message,
      data: null,
    });
  }
}
