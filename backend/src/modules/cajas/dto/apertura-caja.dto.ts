import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsPositive, Min } from 'class-validator';

export class AperturaCajaDto {
  @ApiProperty({ example: 1, description: 'ID de la caja física a aperturar' })
  @IsInt({ message: 'El ID de la caja debe ser un número entero' })
  @IsPositive({ message: 'El ID de la caja debe ser un número positivo' })
  id_caja: number;

  @ApiProperty({ example: 100.0, description: 'Monto inicial de apertura' })
  @IsNumber({}, { message: 'El monto inicial debe ser un número' })
  @Min(0, { message: 'El monto inicial no puede ser negativo' })
  monto_inicial: number;
}
