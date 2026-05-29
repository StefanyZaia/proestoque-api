import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { validate } from "../middlewares/validate";
import { registroSchema, loginSchema } from "../schemas/auth.schema";

const router = Router();
const controller = new AuthController();

// Rotas PÚBLICAS — sem middleware de autenticação
// O middleware validate() roda ANTES do controller (valida o body)
router.post(
  "/registro",
  validate(registroSchema),   // 1º: valida o body com zod
  controller.registrar.bind(controller) // 2º: executa o controller
);

router.post(
  "/login",
  validate(loginSchema),
  controller.login.bind(controller)
);

// Rota PROTEGIDA — requer token válido
// autenticar é importado e aplicado só nessa rota
import { autenticar } from "../middlewares/auth";
router.get("/me", autenticar, controller.perfil.bind(controller));

export { router as authRouter };