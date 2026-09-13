import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateRecetaDto {
  @ApiProperty({ example: 1, description: 'ID del cliente titular de la receta' })
  @IsInt()
  @IsPositive()
  id_cliente: number;

  @ApiProperty({ example: 'REC-2026-001', description: 'Código único de la receta médica' })
  @IsString()
  @IsNotEmpty()
  numero_receta: string;

  @ApiProperty({ example: '2026-09-01', description: 'Fecha de emisión (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  fecha_emision: string;

  @ApiProperty({
    example: '2026-09-30',
    required: false,
    description: 'Fecha de vencimiento (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  fecha_vencimiento?: string;

  @ApiProperty({
    example: 'Uso controlado - Amoxicilina 500mg',
    required: false,
  })
  @IsOptional()
  @IsString()
  observacion?: string;
}
