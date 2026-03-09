import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async me(@Req() req: { user: { sub: string } }) {
    const user = await this.authService.me(req.user.sub);
    if (!user) return null;
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      companyId: user.companyId,
      employeeCode: user.employee?.employeeCode ?? null,
      position: user.employee?.position ?? null,
      department: user.employee?.department ?? null
    };
  }
}
