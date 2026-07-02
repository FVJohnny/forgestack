import { Controller, Get, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, type AuthenticatedRequest } from '@libs/nestjs-common';

@ApiTags('auth')
@Controller('auth')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class GetMe_Controller {
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user information from token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User information retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired token',
  })
  async getMe(@Req() req: AuthenticatedRequest) {
    return {
      userId: req.tokenData.userId,
      email: req.tokenData.email,
      role: req.tokenData.role,
      isImpersonating: req.tokenData.isImpersonating ?? false,
      originalEmail: req.tokenData.originalEmail,
    };
  }
}
