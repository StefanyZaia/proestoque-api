import { NextFunction, Request, Response } from "express";
import { AppError } from "../middlewares/errorHandler";
import { prisma } from "../prisma/client";

export class ProdutoController {
  // ── GET /api/produtos ──────────────────────────────────────
  // Suporta filtros opcionais via query string:
  // /api/produtos?busca=cafe&categoriaId=cat_1&apenasAlerta=true
  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const busca =
        typeof req.query.busca === "string" ? req.query.busca : undefined;

      const categoriaId =
        typeof req.query.categoriaId === "string"
          ? req.query.categoriaId
          : Array.isArray(req.query.categoriaId)
            ? req.query.categoriaId[0]
            : undefined;

      const apenasAlerta =
        typeof req.query.apenasAlerta === "string"
          ? req.query.apenasAlerta
          : undefined;

      const produtos = await prisma.produto.findMany({
        where: {
          ...(busca && {
            nome: { contains: String(busca), mode: "insensitive" },
          }),

          ...(categoriaId && { categoriaId: String(categoriaId) }),

          ...(apenasAlerta === "true" && {
            quantidade: { lt: prisma.produto.fields.quantidadeMinima },
          }),
        },
        include: { categoria: true },
        orderBy: { nome: "asc" },
      });

      res.json(produtos);
    } catch (error) {
      next(error);
    }
  }

  // ── GET /api/produtos/:id ──────────────────────────────────
  async buscarPorId(req: Request, res: Response, next: NextFunction) {
    try {
      const id =
        typeof req.params.id === "string"
          ? req.params.id
          : req.params.id?.[0];

      if (!id) {
        throw new AppError("ID do produto inválido", 400);
      }

      const produto = await prisma.produto.findUnique({
        where: { id },
        include: { categoria: true },
      });

      if (!produto) {
        throw new AppError("Produto não encontrado", 404);
      }

      res.json(produto);
    } catch (error) {
      next(error);
    }
  }

  // ── POST /api/produtos ─────────────────────────────────────
  async criar(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        nome,
        categoriaId,
        quantidade,
        quantidadeMinima,
        preco,
        unidade,
        observacao,
        foto,
      } = req.body;

      if (!nome || !categoriaId || preco === undefined) {
        throw new AppError("Campos obrigatórios: nome, categoriaId, preco");
      }

      const categoriaExiste = await prisma.categoria.findUnique({
        where: { id: categoriaId },
      });

      if (!categoriaExiste) {
        throw new AppError("Categoria não encontrada", 404);
      }

      const produto = await prisma.produto.create({
        data: {
          nome: String(nome).trim(),
          categoriaId,
          quantidade: Number(quantidade ?? 0),
          quantidadeMinima: Number(quantidadeMinima ?? 0),
          preco: Number(preco),
          unidade: String(unidade ?? "un"),
          observacao: observacao ? String(observacao) : null,
          foto: foto ? String(foto) : null,
        },
        include: { categoria: true },
      });

      res.status(201).json(produto);
    } catch (error) {
      next(error);
    }
  }

  // ── PUT /api/produtos/:id ──────────────────────────────────
  async atualizar(req: Request, res: Response, next: NextFunction) {
    try {
      const id =
        typeof req.params.id === "string"
          ? req.params.id
          : req.params.id?.[0];

      if (!id) {
        throw new AppError("ID do produto inválido", 400);
      }

      const {
        nome,
        categoriaId,
        quantidade,
        quantidadeMinima,
        preco,
        unidade,
        observacao,
        foto,
      } = req.body;

      const produtoExiste = await prisma.produto.findUnique({
        where: { id },
      });

      if (!produtoExiste) {
        throw new AppError("Produto não encontrado", 404);
      }

      if (categoriaId) {
        const catExiste = await prisma.categoria.findUnique({
          where: { id: categoriaId },
        });

        if (!catExiste) {
          throw new AppError("Categoria não encontrada", 404);
        }
      }

      const produto = await prisma.produto.update({
        where: { id },
        data: {
          ...(nome !== undefined && { nome: String(nome).trim() }),
          ...(categoriaId !== undefined && { categoriaId }),
          ...(quantidade !== undefined && { quantidade: Number(quantidade) }),
          ...(quantidadeMinima !== undefined && {
            quantidadeMinima: Number(quantidadeMinima),
          }),
          ...(preco !== undefined && { preco: Number(preco) }),
          ...(unidade !== undefined && { unidade: String(unidade) }),
          ...(observacao !== undefined && { observacao: observacao || null }),
          ...(foto !== undefined && { foto: foto || null }),
          ultimaMovimentacao: new Date(),
        },
        include: { categoria: true },
      });

      res.json(produto);
    } catch (error) {
      next(error);
    }
  }

  // ── POST /api/produtos/:id/movimentacao ───────────────────
  async movimentar(req: Request, res: Response, next: NextFunction) {
    try {
      const id =
        typeof req.params.id === "string"
          ? req.params.id
          : req.params.id?.[0];

      if (!id) {
        throw new AppError("ID do produto inválido", 400);
      }

      const { tipo, quantidade, observacao } = req.body ?? {};

      const tipoNormalizado =
        typeof tipo === "string"
          ? tipo
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
          : "";

      const quantidadeNumero = Number(quantidade);

      if (!["entrada", "saida"].includes(tipoNormalizado)) {
        throw new AppError("Tipo deve ser 'entrada' ou 'saida'", 400);
      }

      if (!Number.isInteger(quantidadeNumero) || quantidadeNumero <= 0) {
        throw new AppError(
          "Quantidade deve ser um número inteiro maior que zero",
          400
        );
      }

      const resultado = await prisma.$transaction(async (tx) => {
        const produto = await tx.produto.findUnique({
          where: { id },
        });

        if (!produto) {
          throw new AppError("Produto não encontrado", 404);
        }

        const novaQuantidade =
          tipoNormalizado === "entrada"
            ? produto.quantidade + quantidadeNumero
            : produto.quantidade - quantidadeNumero;

        if (novaQuantidade < 0) {
          throw new AppError(
            "Estoque insuficiente para realizar a saída",
            400
          );
        }

        const movimentacao = await tx.movimentacao.create({
          data: {
            produtoId: id,
            tipo: tipoNormalizado,
            quantidade: quantidadeNumero,
            observacao: observacao ? String(observacao) : null,
          },
        });

        const produtoAtualizado = await tx.produto.update({
          where: { id },
          data: {
            quantidade: novaQuantidade,
            ultimaMovimentacao: new Date(),
          },
          include: {
            categoria: true,
          },
        });

        return {
          movimentacao,
          produto: produtoAtualizado,
        };
      });

      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // ── GET /api/produtos/:id/movimentacoes ───────────────────
  async listarMovimentacoes(req: Request, res: Response, next: NextFunction) {
    try {
      const id =
        typeof req.params.id === "string"
          ? req.params.id
          : req.params.id?.[0];

      if (!id) {
        throw new AppError("ID do produto inválido", 400);
      }

      const produto = await prisma.produto.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!produto) {
        throw new AppError("Produto não encontrado", 404);
      }

      const movimentacoes = await prisma.movimentacao.findMany({
        where: { produtoId: id },
        orderBy: { data: "desc" },
      });

      res.json(movimentacoes);
    } catch (error) {
      next(error);
    }
  }

  // ── DELETE /api/produtos/:id ───────────────────────────────
  async deletar(req: Request, res: Response, next: NextFunction) {
    try {
      const id =
        typeof req.params.id === "string"
          ? req.params.id
          : req.params.id?.[0];

      if (!id) {
        throw new AppError("ID do produto inválido", 400);
      }

      const produtoExiste = await prisma.produto.findUnique({
        where: { id },
      });

      if (!produtoExiste) {
        throw new AppError("Produto não encontrado", 404);
      }

      await prisma.produto.delete({
        where: { id },
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}