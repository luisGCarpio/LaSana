import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductoDto {
  @ApiProperty({
    example: 'MED-0001',
    description: 'Código único del producto',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  codigo: string;

  @ApiProperty({ example: 'Amoxicilina 500mg x 20 cápsulas' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @ApiProperty({
    example: 'Antibiótico de amplio espectro',
    required: false,
  })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ example: 12500.5, description: 'Precio final de venta' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precio_venta: number;

  @ApiProperty({
    example: true,
    default: false,
    description: 'Define si el producto exige receta médica para su venta',
  })
  @IsOptional()
  @IsBoolean()
  requiere_receta?: boolean;
}
