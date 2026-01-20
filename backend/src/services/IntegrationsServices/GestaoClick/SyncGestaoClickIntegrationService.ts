import ShowQueueIntegrationService from "../../QueueIntegrationServices/ShowQueueIntegrationService";
import { syncGestaoClickIntegration } from "./SyncGestaoClickBirthdaysService";

type SyncResult = {
  ok: boolean;
  message: string;
  updatedCount: number;
  lastError: string | null;
  lastSyncAt: Date | null;
};

const SyncGestaoClickIntegrationService = async (
  integrationId: string,
  companyId: number
): Promise<SyncResult> => {
  const integration = await ShowQueueIntegrationService(integrationId, companyId);
  if (integration.type !== "gestaoclick") {
    return {
      ok: false,
      message: "Integração não é do tipo Gestao Click.",
      updatedCount: 0,
      lastError: "Tipo inválido",
      lastSyncAt: null
    };
  }

  const result = await syncGestaoClickIntegration(integration);
  await integration.reload();

  if (result.lastError) {
    return {
      ok: false,
      message: `Sincronização falhou: ${result.lastError}`,
      updatedCount: result.updatedCount,
      lastError: result.lastError,
      lastSyncAt: integration.gcLastSyncAt
    };
  }

  return {
    ok: true,
    message: `Sincronização concluída. Contatos atualizados: ${result.updatedCount}`,
    updatedCount: result.updatedCount,
    lastError: null,
    lastSyncAt: integration.gcLastSyncAt
  };
};

export default SyncGestaoClickIntegrationService;
