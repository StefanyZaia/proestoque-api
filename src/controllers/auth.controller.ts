import bcrypt from "bcrypt";
import { NextFunction, Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import { config } from "../config";
import { AppError } from "../middlewares/errorHandler";
import { prisma } from "../prisma/client";

export type JwtPayload = {
  sub: string;
  nome: string;
  email: string;
  tipo?: "access" | "refresh";
};

function gerarToken(usuario: { id: string; nome: string; email: string }): string {
  const payload: JwtPayload = {
    sub: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    tipo: "access",
  };

  return jwt.sign(payload, config.jwtSecret as jwt.Secret, {
    expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"],
  });
}

function gerarRefreshToken(usuario: { id: string; nome: string; email: string }): string {
  const payload: JwtPayload = {
    sub: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    tipo: "refresh",
  };

  return jwt.sign(payload, config.jwtSecret as jwt.Secret, {
    expiresIn: "30d",
  });
}

async function salvarRefreshToken(usuario: { id: string; nome: string; email: string }) {
  const refreshToken = gerarRefreshToken(usuario);

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { refreshToken },
  });

  return refreshToken;
}

export class AuthController {
  async registrar(req: Request, res: Response, next: NextFunction) {
    try {
      const { nome, email, senha } = req.body;

      const usuarioExistente = await prisma.usuario.findUnique({
        where: { email },
      });

      if (usuarioExistente) {
        throw new AppError("E-mail ja cadastrado", 409);
      }

      const senhaHash = await bcrypt.hash(senha, 10);

      const usuario = await prisma.usuario.create({
        data: { nome, email, senha: senhaHash },
        select: { id: true, nome: true, email: true, criadoEm: true },
      });

      const token = gerarToken(usuario);
      const refreshToken = await salvarRefreshToken(usuario);

      res.status(201).json({
        usuario,
        token,
        refreshToken,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, senha } = req.body;

      const usuario = await prisma.usuario.findUnique({
        where: { email },
      });

      if (!usuario) {
        throw new AppError("E-mail ou senha invalidos", 401);
      }

      const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

      if (!senhaCorreta) {
        throw new AppError("E-mail ou senha invalidos", 401);
      }

      const token = gerarToken(usuario);
      const refreshToken = await salvarRefreshToken(usuario);
      const { senha: _, refreshToken: __, ...usuarioSemSenha } = usuario;

      res.json({
        usuario: usuarioSemSenha,
        token,
        refreshToken,
      });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;

      const payload = jwt.verify(refreshToken, config.jwtSecret) as JwtPayload;

      if (payload.tipo !== "refresh") {
        throw new AppError("Refresh token invalido", 401);
      }

      const usuario = await prisma.usuario.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          nome: true,
          email: true,
          criadoEm: true,
          refreshToken: true,
        },
      });

      if (!usuario || usuario.refreshToken !== refreshToken) {
        throw new AppError("Refresh token invalido", 401);
      }

      const token = gerarToken(usuario);
      const { refreshToken: _, ...usuarioSemRefreshToken } = usuario;

      res.json({
        usuario: usuarioSemRefreshToken,
        token,
        refreshToken,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "TokenExpiredError") {
          next(new AppError("Refresh token expirado. Faca login novamente.", 401));
          return;
        }

        if (error.name === "JsonWebTokenError") {
          next(new AppError("Refresh token invalido", 401));
          return;
        }
      }

      next(error);
    }
  }

  async perfil(req: Request, res: Response, next: NextFunction) {
    try {
      const usuario = await prisma.usuario.findUnique({
        where: { id: req.usuario?.sub },
        select: { id: true, nome: true, email: true, criadoEm: true },
      });

      if (!usuario) throw new AppError("Usuario nao encontrado", 404);

      res.json(usuario);
    } catch (error) {
      next(error);
    }
  }
}
