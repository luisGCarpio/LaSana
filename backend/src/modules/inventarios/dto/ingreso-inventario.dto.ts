import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, Min } from 'class-validator';

export class IngresoInventarioDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  id_lote: number;

  @ApiProperty({ example: 50 })
  @IsInt()
  @IsPositive()
  cantidad: number;

  @ApiProperty({ example: 10, required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock_minimo?: number;

  @ApiProperty({
    example: 2,
    required: false,
    description: 'Solo Dueño (el Gerente siempre ingresa en su sede asignada)',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  id_sucursal?: number;
}
