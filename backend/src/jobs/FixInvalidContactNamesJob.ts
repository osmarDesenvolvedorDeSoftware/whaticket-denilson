import { Op } from "sequelize";
import Contact from "../models/Contact";
import logger from "../utils/logger";
import {
  isInvalidContactName,
  resolveBestContactName
} from "../utils/contactName";

const CronJob = require("cron").CronJob;

type FixResult = {
  processed: number;
  updated: number;
};

export const fixInvalidContactNames = async (
  batchSize = 200
): Promise<FixResult> => {
  let processed = 0;
  let updated = 0;
  let lastId = 0;

  while (true) {
    const contacts = await Contact.findAll({
      where: {
        id: { [Op.gt]: lastId },
        isGroup: false
      },
      order: [["id", "ASC"]],
      limit: batchSize
    });

    if (contacts.length === 0) {
      break;
    }

    for (const contact of contacts) {
      processed += 1;
      lastId = contact.id;

      if (!isInvalidContactName(contact.name)) {
        continue;
      }

      const bestName = resolveBestContactName({
        number: contact.number
      });

      if (bestName && bestName !== contact.name) {
        await contact.update({ name: bestName });
        updated += 1;
      }
    }
  }

  return { processed, updated };
};

export const startFixInvalidContactNamesJob = () => {
  const fixJob = new CronJob(
    "0 30 4 * * *",
    async () => {
      logger.info("[CONTACT-NAME-FIX] Iniciando job de correcao de nomes...");

      try {
        const result = await fixInvalidContactNames();
        logger.info(
          `[CONTACT-NAME-FIX] Job concluido: ${result.updated}/${result.processed} contatos corrigidos`
        );
      } catch (error) {
        logger.error("[CONTACT-NAME-FIX] Erro no job de correcao de nomes:", error);
      }
    },
    null,
    true,
    "America/Sao_Paulo"
  );

  logger.info("[CONTACT-NAME-FIX] Job de correcao iniciado - rodara diariamente 04:30");

  return fixJob;
};
