import { Prisma } from "@prisma/client";
import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}

type PrismaKnownErrorLike = Error & {
  code?: string;
  meta?: {
    target?: unknown;
    constraint?: unknown;
  };
};

function getPrismaTarget(error: PrismaKnownErrorLike) {
  const target = error.meta?.target ?? error.meta?.constraint;

  if (Array.isArray(target)) {
    return target.join(",");
  }

  return String(target ?? "");
}

function getErrorSearchText(error: PrismaKnownErrorLike) {
  return [
    error.message,
    error.code,
    getPrismaTarget(error),
    JSON.stringify(error.meta ?? {}),
  ]
    .join(" ")
    .toLowerCase();
}

function isPrismaKnownError(error: Error): error is PrismaKnownErrorLike {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    "code" in error ||
    error.name === "PrismaClientKnownRequestError"
  );
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ erro: err.message });
    return;
  }

  if (isPrismaKnownError(err)) {
    if (err.code === "P2002") {
      const target = getPrismaTarget(err);
      const searchText = getErrorSearchText(err);

      if (searchText.includes("email") || searchText.includes("usuarios_email_key")) {
        res.status(409).json({ erro: "E-mail ja cadastrado" });
        return;
      }

      if (
        searchText.includes("refreshtoken") ||
        searchText.includes("refresh_token") ||
        searchText.includes("usuarios_refreshtoken_key")
      ) {
        res.status(409).json({
          erro: "Nao foi possivel renovar a sessao. Tente fazer login novamente.",
        });
        return;
      }

      res.status(409).json({
        erro: `Registro duplicado no banco de dados (${target || "campo unico desconhecido"})`,
      });
      return;
    }

    res.status(409).json({ erro: `Erro do banco de dados (${err.code ?? err.name})` });
    return;
  }

  console.error("Erro inesperado:", err);
  res.status(500).json({
    erro: process.env.NODE_ENV === "development" ? err.message : "Erro interno do servidor",
  });
}
