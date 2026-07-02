import { SetMetadata } from '@nestjs/common';
import { DECORATORS } from '@nestjs/swagger/dist/constants';

/**
 * Marks an endpoint as public in Swagger documentation.
 * Removes the bearer auth requirement from this endpoint.
 */
export const PublicApi = () => SetMetadata(DECORATORS.API_SECURITY, []);
