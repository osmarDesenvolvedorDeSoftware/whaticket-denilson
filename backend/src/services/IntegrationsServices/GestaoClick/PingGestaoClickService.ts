import logger from "../../../utils/logger";
import ShowQueueIntegrationService from "../../QueueIntegrationServices/ShowQueueIntegrationService";
import GestaoClickClient from "./GestaoClickClient";

type GestaoClickConfig = {
  gcAccessToken: string;
  gcSecretToken: string;
  gcBaseUrl?: string;
};

type PingResult = {
  ok: boolean;
  message: string;
};

const DEFAULT_BASE_URL = "https://api.beteltecnologia.com/api";

const parseConfig = (jsonContent?: string): GestaoClickConfig => {
  if (!jsonContent) return { gcAccessToken: "", gcSecretToken: "" };
  try {
    return JSON.parse(jsonContent);
  } catch (error) {
    logger.warn({ error }, "GestaoClick jsonContent parse error");
    return { gcAccessToken: "", gcSecretToken: "" };
  }
};

const PingGestaoClickService = async (
  integrationId: string,
  companyId: number
): Promise<PingResult> => {
  const integration = await ShowQueueIntegrationService(integrationId, companyId);
  if (integration.type !== "gestaoclick") {
    return { ok: false, message: "Integração não é do tipo Gestao Click." };
  }

  const cfg = parseConfig(integration.jsonContent);
  const accessToken = cfg.gcAccessToken;
  const secretToken = cfg.gcSecretToken;
  const baseUrl = cfg.gcBaseUrl || DEFAULT_BASE_URL;

  if (!accessToken || !secretToken) {
    return { ok: false, message: "Tokens da Gestao Click não configurados." };
  }

  try {
    const client = new GestaoClickClient({
      baseUrl,
      accessToken,
      secretToken
    });
    await client.listLojas();
    return { ok: true, message: "Conexão OK." };
  } catch (error) {
    const err = error as { response?: { status?: number } };
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      return { ok: false, message: "Tokens inválidos ou sem permissão." };
    }
    if (status === 429) {
      return { ok: false, message: "Limite de requisições atingido." };
    }
    return { ok: false, message: "Falha ao conectar na API." };
  }
};

export default PingGestaoClickService;
