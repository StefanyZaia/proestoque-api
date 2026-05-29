import { Router } from "express";
import { ProdutoController } from "../controllers/produto.controller";
import { autenticar } from "../middlewares/auth";

const router = Router();
const controller = new ProdutoController();

router.use(autenticar);

// Cada linha mapeia: VERBO + URL → função do controller
// O .bind(controller) garante que o 'this' dentro do método aponte para o controller

router.get("/", controller.listar.bind(controller));
router.post("/", controller.criar.bind(controller));

// Movimentações de estoque
router.post("/:id/movimentacao", controller.movimentar.bind(controller));
router.get("/:id/movimentacoes", controller.listarMovimentacoes.bind(controller));

// Rotas por ID
router.get("/:id", controller.buscarPorId.bind(controller));
router.put("/:id", controller.atualizar.bind(controller));
router.delete("/:id", controller.deletar.bind(controller));

export { router as produtoRouter };