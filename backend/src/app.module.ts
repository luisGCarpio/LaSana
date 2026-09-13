import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CajasModule } from './modules/cajas/cajas.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { RecetasModule } from './modules/recetas/recetas.module';
import { ProductosModule } from './modules/productos/productos.module';
import { LotesModule } from './modules/lotes/lotes.module';
import { InventariosModule } from './modules/inventarios/inventarios.module';
import { VentasModule } from './modules/ventas/ventas.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CajasModule,
    ClientesModule,
    RecetasModule,
    ProductosModule,
    LotesModule,
    InventariosModule,
    VentasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
