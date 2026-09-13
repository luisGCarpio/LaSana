import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CajasModule } from './modules/cajas/cajas.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { RecetasModule } from './modules/recetas/recetas.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CajasModule,
    ClientesModule,
    RecetasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
