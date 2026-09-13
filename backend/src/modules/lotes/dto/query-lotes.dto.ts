import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsPositive } from 'class-validator';
import { SEMAFOROS_FEFO } from '../../../common/utils/fefo.util';

export class QueryLotesDto {
  @ApiProperty({ required: false, description: 'Filtrar por producto' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  id_producto?: number;

  @ApiProperty({
    required: false,
    enum: SEMAFOROS_FEFO,
    description: 'Filtrar por estado del semáforo FEFO',
  })
  @IsOptional()
  @IsIn(SEMAFOROS_FEFO)
  semaforo?: string;
}
