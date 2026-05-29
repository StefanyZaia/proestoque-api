import { Router } from "express";
import { produtoRouter } from "./produto.routes";
import { categoriaRouter } from "./categoria.routes";
import { authRouter } from "./auth.routes";

const router = Router();

router.use("/auth",       authRouter);

// Prefixo + router específico
// GET /api/produtos → produtoRouter
// GET /api/categorias → categoriaRouter
router.use("/produtos",   produtoRouter);
router.use("/categorias", categoriaRouter);

// Adicione novas rotas aqui:
// import { usuarioRouter } from "./usuario.routes";
// router.use("/usuarios", usuarioRouter);

export { router };