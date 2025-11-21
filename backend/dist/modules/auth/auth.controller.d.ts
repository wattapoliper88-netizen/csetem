import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { LoginDto } from './dto/login.dto';
import { Response } from 'express';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    register(dto: RegisterDto, res: Response): Promise<{
        accessToken: string;
        user: {
            id: string;
            email: string;
            username: string;
        };
    }>;
    verify(dto: VerifyCodeDto, res: Response): Promise<{
        accessToken: string;
        user: {
            id: string;
            email: string;
            username: string;
        };
    }>;
    login(dto: LoginDto, res: Response): Promise<{
        accessToken: string;
        user: {
            id: string;
            email: string;
            username: string;
        };
    }>;
}
