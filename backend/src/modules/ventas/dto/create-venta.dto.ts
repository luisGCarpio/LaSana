import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';

export class DetalleVentaItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  id_producto: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @IsPositive()
  cantidad: number;
}

export class CreateVentaDto {
  @ApiProperty({ example: 5, required: false })
  @IsOptional()
  @IsInt()
  @IsPositive()
  id_cliente?: number;

  @ApiProperty({
    example: 'REC-2026-001',
    required: false,
    description: 'Obligatoria si algún ítem tiene requiere_receta = true',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  numero_receta?: string;

  @ApiProperty({ type: [DetalleVentaItemDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DetalleVentaItemDto)
  items: DetalleVentaItemDto[];
}
