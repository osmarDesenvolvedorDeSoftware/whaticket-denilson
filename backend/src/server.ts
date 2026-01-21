import 'dotenv/config';
import gracefulShutdown from "http-graceful-shutdown";
import app from "./app";
import { initIO } from "./libs/socket";
import logger from "./utils/logger";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";
import Company from "./models/Company";
import BullQueue from './libs/queue';
import { startQueueProcess } from "./queues";
import { startLidSyncJob } from "./jobs/LidSyncJob";
import { startFixInvalidContactNamesJob } from "./jobs/FixInvalidContactNamesJob";

const server = app.listen(process.env.PORT, async () => {
  const companies = await Company.findAll({
    where: { status: true },
    attributes: ["id"]
  });

  const allPromises: any[] = [];
  companies.map(async c => {
    const promise = StartAllWhatsAppsSessions(c.id);
    allPromises.push(promise);
  });

  Promise.all(allPromises).then(async () => {
    logger.info("Fila de processamento iniciando após sessões do WhatsApp");
    await startQueueProcess();
  });

  if (process.env.REDIS_URI_ACK && process.env.REDIS_URI_ACK !== '') {
    BullQueue.process();
  }

  startLidSyncJob();
  startFixInvalidContactNamesJob();
  logger.info(`Servidor iniciado na porta ${process.env.PORT}`);
});

process.on("uncaughtException", err => {
  logger.error({ msg: "uncaughtException", error: err.message, stack: err.stack?.split("\n")[0] });
  process.exit(1);
});

process.on("unhandledRejection", (reason: any, p: any) => {
  logger.error({ msg: "unhandledRejection", reason: String(reason), promise: String(p) });
  process.exit(1);
});

initIO(server);
gracefulShutdown(server);
