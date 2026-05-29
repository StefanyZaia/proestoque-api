import { NextFunction, Request, Response } from "express";
import { AppError } from "../middlewares/errorHandler";
import { prisma } from "../prisma/client";

export class CategoriaController {
  async listar(_req: Request, res: Response, next: NextFunction) {
    try {
      const categorias = await prisma.categoria.findMany({
        orderBy: { nome: "asc" },
        include: {
          _count: { select: { produtos: true } },
        },
      });

      res.json(categorias);
    } catch (error) {
      next(error);
    }
  }

  async buscarPorId(req: Request, res: Response, next: NextFunction) {
    try {
      const id =
        typeof req.params.id === "string"
          ? req.params.id
          : req.params.id?.[0];

      if (!id) {
        throw new AppError("ID da categoria inválido", 400);
      }

      const categoria = await prisma.categoria.findUnique({
        where: { id },
        include: {
          produtos: { orderBy: { nome: "asc" } },
        },
      });

      if (!categoria) {
        throw new AppError("Categoria não encontrada", 404);
      }

      res.json(categoria);
    } catch (error) {
      next(error);
    }
  }

  async criar(req: Request, res: Response, next: NextFunction) {
    try {
      const { nome, icone, cor } = req.body;

      if (!nome) {
        throw new AppError("Campo obrigatório: nome", 400);
      }

      const categoria = await prisma.categoria.create({
        data: {
          nome,
          icone: icone ?? "package",
          cor: cor ?? "#7c3aed",
        },
      });

      res.status(201).json(categoria);
    } catch (error) {
      next(error);
    }
  }
}