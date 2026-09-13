import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateClienteDto {
  @ApiProperty({
    example: '1020304050',
    description: 'Documento de identidad único del cliente',
  })
  @IsString()
  @IsNotEmpty()
  documento: string;

  @ApiProperty({ example: 'María' })
  @IsString()
  @IsNotEmpty()
  nombres: string;

  @ApiProperty({ example: 'Rodríguez', required: false })
  @IsOptional()
  @IsString()
  apellidos?: string;

  @ApiProperty({ example: '3001234567', required: false })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({ example: 'maria@example.com', required: false })
  @IsOptional()
  @IsEmail()
  correo?: string;

  @ApiProperty({ example: 'Calle 10 # 5-20', required: false })
  @IsOptional()
  @IsString()
  direccion?: string;
}
