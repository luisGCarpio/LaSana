import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClienteDto) {
    if (dto.documento) {
      const existe = await this.prisma.cliente.findUnique({
        where: { documento: dto.documento },
      });
      if (existe) {
        throw new BadRequestException(
          'Ya existe un cliente registrado con este documento',
        );
      }
    }

    return this.prisma.cliente.create({
      data: dto,
    });
  }

  async findByDocumento(documento: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { documento },
    });

    if (!cliente) {
      throw new NotFoundException(
        'Cliente no encontrado con el documento especificado',
      );
    }

    return cliente;
  }

  async findAll() {
    return this.prisma.cliente.findMany({
      orderBy: { id_cliente: 'desc' },
    });
  }

  async findById(id_cliente: number) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id_cliente },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id_cliente} no encontrado`);
    }

    return cliente;
  }
}
