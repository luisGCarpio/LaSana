import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class QueryProductosDto {
  @ApiProperty({
    required: false,
    description: 'Búsqueda por código o nombre (coincidencia parcial)',
  })
  @IsOptional()
  @IsString()
  busqueda?: string;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true',
  )
  @IsBoolean()
  activo?: boolean;
}
