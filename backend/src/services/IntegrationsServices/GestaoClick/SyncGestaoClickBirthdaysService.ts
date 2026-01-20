import QueueIntegrations from "../../../models/QueueIntegrations";
import Contact from "../../../models/Contact";
import logger from "../../../utils/logger";
import CreateContactService from "../../ContactServices/CreateContactService";
import GestaoClickClient, { GestaoClickCliente } from "./GestaoClickClient";

type GestaoClickConfig = {
  gcAccessToken: string;
  gcSecretToken: string;
  gcBaseUrl?: string;
};

const DEFAULT_BASE_URL = "https://api.beteltecnologia.com/api";
const REQUEST_DELAY_MS = 350;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const onlyDigits = (value: string) => String(value || "").replace(/\D/g, "");

const normalizePhone = (value?: string): string | null => {
  const raw = onlyDigits(value || "");
  if (!raw) return null;

  let digits = raw;
  if (digits.startsWith("0")) {
    if (digits.length === 11) {
      digits = digits.slice(1);
    } else if (digits.length === 12 || digits.length === 13) {
      digits = digits.slice(3);
    }
  }

  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }

  if (!(digits.length === 12 || digits.length === 13)) return null;
  if (/^0+$/.test(digits)) return null;

  return digits;
};

const parseBirthDate = (value?: string): Date | null => {
  if (!value) return null;
  if (value === "0000-00-00") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900) return null;

  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  if (date > new Date()) return null;

  return date;
};

const shouldUpdateName = (currentName?: string): boolean => {
  if (!currentName) return false;
  return /^\d+$/.test(currentName);
};

const normalizeName = (value?: string): string => {
  const name = String(value || "").trim();
  if (!name) return "";
  const isUpper = name === name.toUpperCase() && name !== name.toLowerCase();
  if (!isUpper) return name;

  const lower = name.toLowerCase();
  const keepLower = new Set(["dos", "da", "de"]);
  return lower
    .split(" ")
    .filter(part => part.length > 0)
    .map(part =>
      part
        .split("-")
        .map(segment => {
          if (!segment) return segment;
          if (keepLower.has(segment)) return segment;
          return segment.charAt(0).toUpperCase() + segment.slice(1);
        })
        .join("-")
    )
    .join(" ");
};

const sameDateOnly = (a?: Date | null, b?: Date | null): boolean => {
  if (!a || !b) return false;
  const toKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  return toKey(a) === toKey(b);
};

const parseConfig = (jsonContent?: string): GestaoClickConfig => {
  if (!jsonContent) return { gcAccessToken: "", gcSecretToken: "" };
  try {
    return JSON.parse(jsonContent);
  } catch (error) {
    logger.warn({ error }, "GestaoClick jsonContent parse error");
    return { gcAccessToken: "", gcSecretToken: "" };
  }
};

const upsertContactFromCliente = async (
  companyId: number,
  cliente: GestaoClickCliente
): Promise<boolean> => {
  const phone =
    normalizePhone(cliente.celular) || normalizePhone(cliente.telefone);
  if (!phone) return false;

  const birthDate = parseBirthDate(cliente.data_nascimento);
  const normalizedName = normalizeName(cliente.nome);

  const contact = await Contact.findOne({
    where: { number: phone, companyId }
  });

  if (!contact) {
    if (!birthDate) return false;
    await CreateContactService({
      name: normalizedName || phone,
      number: phone,
      companyId,
      birthDate
    });
    return true;
  }

  const updates: { birthDate?: Date; name?: string } = {};
  if (birthDate && !sameDateOnly(contact.birthDate, birthDate)) {
    updates.birthDate = birthDate;
  }

  if (shouldUpdateName(contact.name) && normalizedName) {
    if (contact.name !== normalizedName) {
      updates.name = normalizedName;
    }
  }

  if (Object.keys(updates).length === 0) return false;

  await contact.update(updates);
  return true;
};

export const syncGestaoClickIntegration = async (
  integration: QueueIntegrations
): Promise<{ updatedCount: number; lastError: string | null }> => {
  let updatedCount = 0;
  const companyId = integration.companyId;

  try {
    const cfg = parseConfig(integration.jsonContent);
    const accessToken = cfg.gcAccessToken;
    const secretToken = cfg.gcSecretToken;
    const baseUrl = cfg.gcBaseUrl || DEFAULT_BASE_URL;

    if (!accessToken || !secretToken) {
      throw new Error("GestaoClick tokens missing");
    }

    const client = new GestaoClickClient({
      baseUrl,
      accessToken,
      secretToken
    });

    let page = 1;
    let totalPages = 1;
    do {
      const response = await client.listClientes(page);
      const clientes = response.data || [];
      totalPages = response.meta?.total_paginas || totalPages;

      for (const cliente of clientes) {
        const updated = await upsertContactFromCliente(companyId, cliente);
        if (updated) updatedCount += 1;
      }

      page += 1;
      if (page <= totalPages) {
        await sleep(REQUEST_DELAY_MS);
      }
    } while (page <= totalPages);

    await integration.update({
      gcLastSyncAt: new Date(),
      gcUpdatedCount: updatedCount,
      gcLastError: null
    });

    return { updatedCount, lastError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(
      { error: message, integrationId: integration.id, companyId },
      "GestaoClick sync failed"
    );
    await integration.update({
      gcLastSyncAt: new Date(),
      gcUpdatedCount: updatedCount,
      gcLastError: message
    });
    return { updatedCount, lastError: message };
  }
};

const SyncGestaoClickBirthdaysService = async (): Promise<void> => {
  const integrations = await QueueIntegrations.findAll({
    where: { type: "gestaoclick" }
  });

  for (const integration of integrations) {
    await syncGestaoClickIntegration(integration);
  }
};

export default SyncGestaoClickBirthdaysService;
