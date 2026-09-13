import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateLoteDto {
  @ApiProperty({ example: 1, description: 'ID del producto al que pertenece' })
  @IsInt()
  @IsPositive()
  id_producto: number;

  @ApiProperty({ example: 'L-2026-014' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  numero_lote: string;

  @ApiProperty({ example: '2026-03-01', required: false })
  @IsOptional()
  @IsDateString()
  fecha_fabricacion?: string;

  @ApiProperty({ example: '2027-06-30' })
  @IsDateString()
  @IsNotEmpty()
  fecha_vencimiento: string;
}
