import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @Length(3, 32)
  username: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
