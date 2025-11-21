import { ConfigService } from '@nestjs/config';
declare const JwtStrategy_base: new (...args: any) => any;
export declare class JwtStrategy extends JwtStrategy_base {
    constructor(config: ConfigService);
    validate(payload: {
        sub: string;
        isAdmin: boolean;
    }): Promise<{
        userId: string;
        isAdmin: boolean;
    }>;
}
export {};
