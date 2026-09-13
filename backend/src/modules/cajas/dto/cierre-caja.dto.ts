import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CierreCajaDto {
  @ApiProperty({
    example: 450.5,
    description: 'Monto físico contado en el arqueo de caja',
  })
  @IsNumber({}, { message: 'El monto físico debe ser un número' })
  @Min(0, { message: 'El monto físico no puede ser negativo' })
  monto_fisico: number;

  @ApiProperty({
    example: 'Turno finalizado sin novedades',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto' })
  observacion?: string;
}
