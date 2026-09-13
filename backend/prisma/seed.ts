import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando carga de datos de prueba para Farmacia La Sana...\n');

  // 1. ROLES (3 roles exactos)
  console.log('📌 Insertando roles...');
  const rolesData = [
    { nombre: 'Dueño', descripcion: 'Propietario del negocio con acceso total' },
    { nombre: 'Gerente', descripcion: 'Gerente general con gestión administrativa y operativa' },
    { nombre: 'Cajero', descripcion: 'Cajero y atención farmacéutica en punto de venta' },
  ];

  const rolesMap = new Map<string, number>();
  for (const r of rolesData) {
    const rol = await prisma.rol.upsert({
      where: { nombre: r.nombre },
      update: { descripcion: r.descripcion },
      create: r,
    });
    rolesMap.set(rol.nombre, rol.id_rol);
  }
  console.log(`✅ Roles listos: ${[...rolesMap.keys()].join(', ')}`);

  // 2. SUCURSALES (4 sucursales exactas)
  console.log('\n📌 Insertando sucursales...');
  const sucursalesData = [
    { nombre: 'Sede Principal - Centro', direccion: 'Cra. 5 # 12-34, Cali', telefono: '3101234561' },
    { nombre: 'Sede Norte', direccion: 'Av. 6N # 25-14, Cali', telefono: '3101234562' },
    { nombre: 'Sede Sur', direccion: 'Calle 5 # 66-10, Cali', telefono: '3101234563' },
    { nombre: 'Sede Oriente', direccion: 'Cra. 15 # 45-20, Cali', telefono: '3101234564' },
  ];

  const sucursalesMap = new Map<string, number>();
  for (const s of sucursalesData) {
    let sucursal = await prisma.sucursal.findFirst({ where: { nombre: s.nombre } });
    if (!sucursal) {
      sucursal = await prisma.sucursal.create({ data: s });
    }
    sucursalesMap.set(sucursal.nombre, sucursal.id_sucursal);
  }
  console.log(`✅ Sucursales listas (${sucursalesMap.size} sedes)`);

  // 3. CAJAS (4 cajas exactas, 1 por sede)
  console.log('\n📌 Insertando cajas...');
  const cajasData = [
    { id_sucursal: sucursalesMap.get('Sede Principal - Centro')!, nombre: 'Caja 01 - Centro' },
    { id_sucursal: sucursalesMap.get('Sede Norte')!, nombre: 'Caja 01 - Norte' },
    { id_sucursal: sucursalesMap.get('Sede Sur')!, nombre: 'Caja 01 - Sur' },
    { id_sucursal: sucursalesMap.get('Sede Oriente')!, nombre: 'Caja 01 - Oriente' },
  ];

  const cajasMap = new Map<string, number>();
  for (const c of cajasData) {
    const caja = await prisma.caja.upsert({
      where: {
        id_sucursal_nombre: {
          id_sucursal: c.id_sucursal,
          nombre: c.nombre,
        },
      },
      update: {},
      create: {
        id_sucursal: c.id_sucursal,
        nombre: c.nombre,
        activa: true,
      },
    });
    cajasMap.set(caja.nombre, caja.id_caja);
  }
  console.log(`✅ Cajas listas (${cajasMap.size} cajas)`);

  // 4. EMPLEADOS Y USUARIOS (1 Dueño, 1 Gerente, 4 Cajeros)
  console.log('\n📌 Insertando empleados y usuarios...');
  const passwordComun = 'Password123!';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(passwordComun, salt);

  const personalData = [
    {
      documento: '111000001',
      nombres: 'Carlos',
      apellidos: 'Dueñas Gómez',
      telefono: '3105550001',
      correo: 'carlos.duenas@lasana.com',
      cargo: 'Dueño / Propietario',
      rolNombre: 'Dueño',
      sucursalNombre: 'Sede Principal - Centro',
      nombre_usuario: 'dueno',
    },
    {
      documento: '111000002',
      nombres: 'Laura',
      apellidos: 'Martínez Silva',
      telefono: '3105550002',
      correo: 'laura.martinez@lasana.com',
      cargo: 'Gerente General',
      rolNombre: 'Gerente',
      sucursalNombre: 'Sede Principal - Centro',
      nombre_usuario: 'gerente',
    },
    {
      documento: '111000003',
      nombres: 'Andrés',
      apellidos: 'Castaño Ruiz',
      telefono: '3105550003',
      correo: 'andres.castano@lasana.com',
      cargo: 'Cajero / Farmacéutico',
      rolNombre: 'Cajero',
      sucursalNombre: 'Sede Principal - Centro',
      nombre_usuario: 'cajero.centro',
    },
    {
      documento: '111000004',
      nombres: 'Valentina',
      apellidos: 'Ríos Morales',
      telefono: '3105550004',
      correo: 'valentina.rios@lasana.com',
      cargo: 'Cajera / Farmacéutica',
      rolNombre: 'Cajero',
      sucursalNombre: 'Sede Norte',
      nombre_usuario: 'cajero.norte',
    },
    {
      documento: '111000005',
      nombres: 'Mateo',
      apellidos: 'Morales Castro',
      telefono: '3105550005',
      correo: 'mateo.morales@lasana.com',
      cargo: 'Cajero / Farmacéutico',
      rolNombre: 'Cajero',
      sucursalNombre: 'Sede Sur',
      nombre_usuario: 'cajero.sur',
    },
    {
      documento: '111000006',
      nombres: 'Daniela',
      apellidos: 'Herrera Díaz',
      telefono: '3105550006',
      correo: 'daniela.herrera@lasana.com',
      cargo: 'Cajera / Farmacéutica',
      rolNombre: 'Cajero',
      sucursalNombre: 'Sede Oriente',
      nombre_usuario: 'cajero.oriente',
    },
  ];

  const empleadosMap = new Map<string, number>();
  for (const p of personalData) {
    const rolId = rolesMap.get(p.rolNombre)!;
    const sucursalId = sucursalesMap.get(p.sucursalNombre)!;

    const empleado = await prisma.empleado.upsert({
      where: { documento: p.documento },
      update: {
        nombres: p.nombres,
        apellidos: p.apellidos,
        telefono: p.telefono,
        correo: p.correo,
        cargo: p.cargo,
        id_rol: rolId,
        id_sucursal: sucursalId,
      },
      create: {
        documento: p.documento,
        nombres: p.nombres,
        apellidos: p.apellidos,
        telefono: p.telefono,
        correo: p.correo,
        cargo: p.cargo,
        id_rol: rolId,
        id_sucursal: sucursalId,
      },
    });
    empleadosMap.set(p.nombre_usuario, empleado.id_empleado);

    await prisma.usuario.upsert({
      where: { id_empleado: empleado.id_empleado },
      update: {
        nombre_usuario: p.nombre_usuario,
        password_hash: passwordHash,
        activo: true,
      },
      create: {
        id_empleado: empleado.id_empleado,
        nombre_usuario: p.nombre_usuario,
        password_hash: passwordHash,
        activo: true,
      },
    });
  }
  console.log(`✅ 6 Empleados y 6 Usuarios creados (contraseña: "${passwordComun}")`);

  // 5. CIERRES DE CAJA HISTÓRICOS (Todas las cajas quedan CERRADAS para requerir apertura en el front)
  console.log('\n📌 Insertando turno previo cerrado en historial (cajas actualmente cerradas)...');
  const cajaCentroId = cajasMap.get('Caja 01 - Centro')!;
  const cajeroCentroId = empleadosMap.get('cajero.centro')!;

  const turnoPrevio = await prisma.cierre_caja.findFirst({
    where: { id_caja: cajaCentroId, estado: 'CERRADA' },
  });

  if (!turnoPrevio) {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const ayerCierre = new Date(ayer);
    ayerCierre.setHours(ayer.getHours() + 8);

    await prisma.cierre_caja.create({
      data: {
        id_caja: cajaCentroId,
        id_empleado: cajeroCentroId,
        fecha_apertura: ayer,
        fecha_cierre: ayerCierre,
        monto_inicial: 100000,
        monto_esperado: 100000,
        monto_fisico: 100000,
        diferencia: 0,
        estado: 'CERRADA',
        observacion: 'Turno histórico de ayer cerrado correctamente. Caja cerrada lista para apertura.',
      },
    });
    console.log('✅ Historial registrado. Estado actual: TODAS LAS CAJAS CERRADAS (listas para abrir con 100k).');
  } else {
    console.log('✅ Verificado: cajas cerradas.');
  }

  // 6. CLIENTES (2 clientes de prueba)
  console.log('\n📌 Insertando clientes...');
  const clientesData = [
    {
      documento: '1005123456',
      nombres: 'Juan Camilo',
      apellidos: 'Pérez Moreno',
      telefono: '3001112233',
      correo: 'juan.perez@example.com',
      direccion: 'Calle 15 # 4-50, Cali',
    },
    {
      documento: '1005654321',
      nombres: 'María Camila',
      apellidos: 'López Rivera',
      telefono: '3004445566',
      correo: 'maria.lopez@example.com',
      direccion: 'Carrera 80 # 11-20, Cali',
    },
  ];

  const clientesMap = new Map<string, number>();
  for (const cl of clientesData) {
    const cliente = await prisma.cliente.upsert({
      where: { documento: cl.documento },
      update: cl,
      create: cl,
    });
    clientesMap.set(cl.documento, cliente.id_cliente);
  }
  console.log(`✅ ${clientesMap.size} Clientes listos`);

  // 7. RECETAS MÉDICAS (1 vigente y 1 vencida)
  console.log('\n📌 Insertando recetas médicas...');
  const hoy = new Date();
  const hace10Dias = new Date(hoy);
  hace10Dias.setDate(hoy.getDate() - 10);
  const en30Dias = new Date(hoy);
  en30Dias.setDate(hoy.getDate() + 30);

  const hace50Dias = new Date(hoy);
  hace50Dias.setDate(hoy.getDate() - 50);
  const hace20Dias = new Date(hoy);
  hace20Dias.setDate(hoy.getDate() - 20);

  const recetasData = [
    {
      id_cliente: clientesMap.get('1005123456')!,
      numero_receta: 'RX-2026-001',
      fecha_emision: hace10Dias,
      fecha_vencimiento: en30Dias,
      observacion: 'Tratamiento con Amoxicilina 500mg c/8h por 7 días (RECETA VIGENTE)',
    },
    {
      id_cliente: clientesMap.get('1005654321')!,
      numero_receta: 'RX-2025-999',
      fecha_emision: hace50Dias,
      fecha_vencimiento: hace20Dias,
      observacion: 'Tratamiento finalizado (RECETA VENCIDA PARA PRUEBA DE RECHAZO)',
    },
  ];

  for (const r of recetasData) {
    await prisma.receta.upsert({
      where: { numero_receta: r.numero_receta },
      update: r,
      create: r,
    });
  }
  console.log('✅ Recetas listas (RX-2026-001 vigente, RX-2025-999 vencida)');

  // 8. PROVEEDOR (1 proveedor farmacéutico)
  console.log('\n📌 Insertando proveedor...');
  const proveedor = await prisma.proveedor.upsert({
    where: { nit: '900123456-1' },
    update: {},
    create: {
      nombre: 'Distribuidora Farmacéutica del Valle S.A.S.',
      nit: '900123456-1',
      telefono: '6025551234',
      correo: 'ventas@farmavalle.com',
      direccion: 'Zona Industrial Acopi, Yumbo',
    },
  });
  console.log(`✅ Proveedor listo: ${proveedor.nombre}`);

  // 9. PRODUCTOS (4 productos: 2 OTC y 2 bajo receta)
  console.log('\n📌 Insertando productos...');
  const productosData = [
    {
      codigo: 'MED-001',
      nombre: 'Acetaminofén 500mg (Caja x 20)',
      descripcion: 'Analgésico y antipirético de venta libre',
      precio_venta: 4500,
      requiere_receta: false,
    },
    {
      codigo: 'MED-002',
      nombre: 'Ibuprofeno 600mg (Caja x 10)',
      descripcion: 'Antiinflamatorio no esteroideo de venta libre',
      precio_venta: 8500,
      requiere_receta: false,
    },
    {
      codigo: 'MED-003',
      nombre: 'Amoxicilina 500mg (Caja x 15)',
      descripcion: 'Antibiótico betalactámico para infecciones bacterianas',
      precio_venta: 18000,
      requiere_receta: true,
    },
    {
      codigo: 'MED-004',
      nombre: 'Losartán Potásico 50mg (Caja x 30)',
      descripcion: 'Antihipertensivo para control de presión arterial',
      precio_venta: 14500,
      requiere_receta: true,
    },
  ];

  const productosMap = new Map<string, number>();
  for (const prod of productosData) {
    const p = await prisma.producto.upsert({
      where: { codigo: prod.codigo },
      update: prod,
      create: prod,
    });
    productosMap.set(p.codigo, p.id_producto);
  }
  console.log(`✅ ${productosMap.size} Productos listos`);

  // 10. LOTES (1 lote por producto con vencimiento futuro)
  console.log('\n📌 Insertando lotes...');
  const lotesData = [
    {
      id_producto: productosMap.get('MED-001')!,
      numero_lote: 'LOT-ACE-2026A',
      fecha_fabricacion: new Date('2026-01-10'),
      fecha_vencimiento: new Date('2028-01-10'),
    },
    {
      id_producto: productosMap.get('MED-002')!,
      numero_lote: 'LOT-IBU-2026B',
      fecha_fabricacion: new Date('2026-02-15'),
      fecha_vencimiento: new Date('2027-10-15'),
    },
    {
      id_producto: productosMap.get('MED-003')!,
      numero_lote: 'LOT-AMO-2026A',
      fecha_fabricacion: new Date('2026-01-20'),
      fecha_vencimiento: new Date('2027-08-20'),
    },
    {
      id_producto: productosMap.get('MED-004')!,
      numero_lote: 'LOT-LOS-2026C',
      fecha_fabricacion: new Date('2026-03-05'),
      fecha_vencimiento: new Date('2028-03-05'),
    },
  ];

  const lotesMap = new Map<string, number>();
  for (const l of lotesData) {
    const lote = await prisma.lote.upsert({
      where: {
        id_producto_numero_lote: {
          id_producto: l.id_producto,
          numero_lote: l.numero_lote,
        },
      },
      update: l,
      create: l,
    });
    lotesMap.set(l.numero_lote, lote.id_lote);
  }
  console.log(`✅ ${lotesMap.size} Lotes listos`);

  // 11. INVENTARIO POR LOTE Y SUCURSAL (50 unidades de cada producto en cada una de las 4 sedes)
  console.log('\n📌 Insertando inventario inicial en las 4 sedes...');
  let totalInventarios = 0;
  for (const [, sucursalId] of sucursalesMap) {
    for (const [, loteId] of lotesMap) {
      await prisma.inventario_lote.upsert({
        where: {
          id_sucursal_id_lote: {
            id_sucursal: sucursalId,
            id_lote: loteId,
          },
        },
        update: { cantidad: 50, stock_minimo: 10 },
        create: {
          id_sucursal: sucursalId,
          id_lote: loteId,
          cantidad: 50,
          stock_minimo: 10,
        },
      });
      totalInventarios++;
    }
  }
  console.log(`✅ Inventario listo: 50 unidades por producto en cada sede (${totalInventarios} registros)`);

  console.log('\n🎉 ¡Carga de datos de prueba finalizada exitosamente!');
}

main()
  .catch((e) => {
    console.error('❌ Error durante la ejecución del seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
