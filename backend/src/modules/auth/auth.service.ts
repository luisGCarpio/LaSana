import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

interface IntentoLogin {
  intentos: number;
  ultimoIntento: number;
  bloqueadoHasta?: number;
}

@Injectable()
export class AuthService {
  private readonly intentosFallidos = new Map<string, IntentoLogin>();
  private readonly TIEMPO_BLOQUEO_MS = 3600 * 1000; // 1 hora
  private readonly MAX_INTENTOS = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { nombre_usuario, password } = loginDto;
    const ahora = Date.now();

    // Validar si la cuenta está temporalmente bloqueada por fuerza bruta
    const registroIntento = this.intentosFallidos.get(nombre_usuario);
    if (registroIntento?.bloqueadoHasta) {
      if (ahora < registroIntento.bloqueadoHasta) {
        const minutosRestantes = Math.ceil((registroIntento.bloqueadoHasta - ahora) / 60000);
        throw new UnauthorizedException(
          `La cuenta se encuentra bloqueada temporalmente por exceso de intentos fallidos. Intente nuevamente en ${minutosRestantes} minuto(s).`,
        );
      } else {
        // El período de bloqueo ya expiró
        this.intentosFallidos.delete(nombre_usuario);
      }
    }

    // Buscar usuario en la base de datos con empleado, rol y sucursal
    const usuario = await this.prisma.usuario.findUnique({
      where: { nombre_usuario },
      include: {
        empleado: {
          include: {
            rol: true,
            sucursal: true,
          },
        },
      },
    });

    let passwordValida = false;
    if (usuario && usuario.activo && usuario.password_hash) {
      passwordValida = await bcrypt.compare(password, usuario.password_hash);
    }

    if (!usuario || !usuario.activo || !passwordValida) {
      // Registrar intento fallido
      const actual = this.intentosFallidos.get(nombre_usuario) || {
        intentos: 0,
        ultimoIntento: ahora,
      };

      // Si el último intento fue hace más de 1 hora y no estaba bloqueado, reiniciar contador
      if (ahora - actual.ultimoIntento > this.TIEMPO_BLOQUEO_MS && !actual.bloqueadoHasta) {
        actual.intentos = 0;
      }

      actual.intentos += 1;
      actual.ultimoIntento = ahora;

      if (actual.intentos >= this.MAX_INTENTOS) {
        actual.bloqueadoHasta = ahora + this.TIEMPO_BLOQUEO_MS;
      }

      this.intentosFallidos.set(nombre_usuario, actual);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Credenciales válidas: limpiar intentos fallidos
    this.intentosFallidos.delete(nombre_usuario);

    // Generar token JWT
    const payload = {
      sub: usuario.id_usuario,
      id_empleado: usuario.empleado.id_empleado,
      id_sucursal: usuario.empleado.id_sucursal,
      rol: usuario.empleado.rol.nombre,
    };

    const token = this.jwtService.sign(payload);

    // Registrar en auditoría de empleado
    await this.prisma.auditoria_empleado.create({
      data: {
        id_empleado: usuario.id_empleado,
        accion: 'LOGIN',
        modulo: 'auth',
        tabla_afectada: 'usuario',
        id_registro: usuario.id_usuario,
        descripcion: 'Inicio de sesión exitoso',
      },
    });

    return {
      access_token: token,
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre_usuario: usuario.nombre_usuario,
        id_empleado: usuario.empleado.id_empleado,
        id_sucursal: usuario.empleado.id_sucursal,
        rol: usuario.empleado.rol.nombre,
        nombres: usuario.empleado.nombres,
        apellidos: usuario.empleado.apellidos,
      },
    };
  }

  async getPerfil(id_usuario: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario },
      select: {
        id_usuario: true,
        id_empleado: true,
        nombre_usuario: true,
        activo: true,
        fecha_creacion: true,
        ultimo_acceso: true,
        empleado: {
          include: {
            rol: true,
            sucursal: true,
          },
        },
      },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id_usuario} no encontrado`);
    }

    return usuario;
  }
}
