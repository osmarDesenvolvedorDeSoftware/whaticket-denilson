import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as QueueIntegrationController from "../controllers/QueueIntegrationController";

const queueIntegrationRoutes = Router();

queueIntegrationRoutes.get("/queueIntegration", isAuth, QueueIntegrationController.index);

queueIntegrationRoutes.post("/queueIntegration", isAuth, QueueIntegrationController.store);

queueIntegrationRoutes.get("/queueIntegration/:integrationId", isAuth, QueueIntegrationController.show);

queueIntegrationRoutes.put("/queueIntegration/:integrationId", isAuth, QueueIntegrationController.update);

queueIntegrationRoutes.delete("/queueIntegration/:integrationId", isAuth, QueueIntegrationController.remove);

queueIntegrationRoutes.post("/queueIntegration/testsession", isAuth, QueueIntegrationController.testSession);

queueIntegrationRoutes.post(
  "/queueIntegration/:integrationId/test-gestaoclick",
  isAuth,
  QueueIntegrationController.testGestaoClickContact
);
queueIntegrationRoutes.get(
  "/queueIntegration/:integrationId/ping-gestaoclick",
  isAuth,
  QueueIntegrationController.pingGestaoClick
);

export default queueIntegrationRoutes;
