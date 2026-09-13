import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Nombre de usuario',
    example: 'cajero1',
  })
  @IsString({ message: 'El nombre de usuario debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre de usuario no puede estar vacío' })
  nombre_usuario: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'Password123!',
  })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña no puede estar vacía' })
  password: string;
}
