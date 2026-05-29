import bcrypt from "bcrypt";
import { NextFunction, Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import { config } from "../config";
import { AppError } from "../middlewares/errorHandler";
import { prisma } from "../prisma/client";

// Tipo que o JWT vai carregar no payload
// Exportado para reutilizar no middleware de autenticação
export type JwtPayload = {
  sub: string;  // subject = ID do usuário (padrão JWT)
  nome: string;
  email: string;
};

// Função auxiliar: gera o JWT com os dados do usuário
function gerarToken(usuario: { id: string; nome: string; email: string }): string {
  const payload: JwtPayload = {
    sub: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
  };

  // sign(payload, secret, options)
  return jwt.sign(payload, config.jwtSecret as jwt.Secret, {
    expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"],
  });
}

export class AuthController {

  // ── POST /api/auth/registro ──────────────────────────────────
  async registrar(req: Request, res: Response, next: NextFunction) {
    try {
      const { nome, email, senha } = req.body;
      // req.body já foi validado pelo middleware validate(registroSchema)

      // 1. Verificar se o e-mail já está em uso
      const usuarioExistente = await prisma.usuario.findUnique({
        where: { email },
      });

      if (usuarioExistente) {
        // 409 Conflict = recurso já existe
        throw new AppError("E-mail já cadastrado", 409);
      }

      // 2. Gerar o hash da senha (NUNCA salvar a senha em texto puro)
      const senhaHash = await bcrypt.hash(senha, 10);

      // 3. Criar o usuário no banco com o hash
      const usuario = await prisma.usuario.create({
        data: { nome, email, senha: senhaHash },
        // select: retorna APENAS os campos listados
        // Garante que a senha (hash) NUNCA volta para o cliente
        select: { id: true, nome: true, email: true, criadoEm: true },
      });

      // 4. Gerar o JWT com os dados do novo usuário
      const token = gerarToken(usuario);

      // 201 Created: novo recurso criado
      res.status(201).json({
        usuario,
        token,
        // O cliente vai guardar esse token no AsyncStorage
      });
    } catch (error) {
      next(error);
    }
  }

  // ── POST /api/auth/login ─────────────────────────────────────
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, senha } = req.body;

      // 1. Buscar o usuário pelo e-mail
      const usuario = await prisma.usuario.findUnique({
        where: { email },
      });

      // ⚠️ IMPORTANTE: Mensagem de erro genérica, não específica
      // "Usuário não encontrado" vaza informação de quais e-mails existem
      // "E-mail ou senha inválidos" protege a privacidade
      if (!usuario) {
        throw new AppError("E-mail ou senha inválidos", 401);
      }

      // 2. Comparar a senha enviada com o hash do banco
      const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

      if (!senhaCorreta) {
        // Mesmo erro genérico — não diz se foi o e-mail ou a senha
        throw new AppError("E-mail ou senha inválidos", 401);
      }

      // 3. Gerar o JWT
      const token = gerarToken(usuario);

      // 4. Retornar usuário SEM a senha + token
      const { senha: _, ...usuarioSemSenha } = usuario;
      // O spread + omissão garante que o hash nunca chega ao cliente

      res.json({
        usuario: usuarioSemSenha,
        token,
      });
    } catch (error) {
      next(error);
    }
  }

  // ── GET /api/auth/me ─────────────────────────────────────────
  // Retorna os dados do usuário autenticado (rota protegida)
  async perfil(req: Request, res: Response, next: NextFunction) {
    try {
      // req.usuario é populado pelo middleware de auth (próxima seção)
      const usuario = await prisma.usuario.findUnique({
        where: { id: (req as any).usuario.sub },
        select: { id: true, nome: true, email: true, criadoEm: true },
      });

      if (!usuario) throw new AppError("Usuário não encontrado", 404);

      res.json(usuario);
    } catch (error) {
      next(error);
    }
  }
}