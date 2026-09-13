import { Module } from '@nestjs/common';
import { CajasController } from './cajas.controller';
import { CajasService } from './cajas.service';

@Module({
  controllers: [CajasController],
  providers: [CajasService],
  exports: [CajasService],
})
export class CajasModule {}
