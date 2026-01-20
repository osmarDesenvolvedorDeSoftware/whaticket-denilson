import QueueIntegrations from "../../../models/QueueIntegrations";
import Contact from "../../../models/Contact";
import logger from "../../../utils/logger";
import CreateContactService from "../../ContactServices/CreateContactService";
import ShowQueueIntegrationService from "../../QueueIntegrationServices/ShowQueueIntegrationService";
import GestaoClickClient, { GestaoClickCliente } from "./GestaoClickClient";

type GestaoClickConfig = {
  gcAccessToken: string;
  gcSecretToken: string;
  gcBaseUrl?: string;
};

type TestResult = {
  updated: boolean;
  created: boolean;
  message: string;
  contactId?: number;
  clienteId?: string;
};

const DEFAULT_BASE_URL = "https://api.beteltecnologia.com/api";
const TEST_SEARCH_PAGES = 5;

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

const pickClienteByBirthDate = (
  clientes: GestaoClickCliente[]
): GestaoClickCliente | null => {
  if (!clientes.length) return null;
  for (const cliente of clientes) {
    if (parseBirthDate(cliente.data_nascimento)) {
      return cliente;
    }
  }
  return clientes[0];
};

const findClienteByPhone = async (
  client: GestaoClickClient,
  targetPhone: string
): Promise<GestaoClickCliente | null> => {
  const rawPhone = onlyDigits(targetPhone);
  const telefoneParam =
    rawPhone.startsWith("55") && (rawPhone.length === 12 || rawPhone.length === 13)
      ? rawPhone.slice(2)
      : rawPhone;
  if (rawPhone) {
    const response = await client.listClientesByTelefone(telefoneParam);
    const clientes = response.data || [];
    const matched = clientes.filter(cliente => {
      const phone =
        normalizePhone(cliente.celular) || normalizePhone(cliente.telefone);
      return phone === targetPhone;
    });
    const picked = pickClienteByBirthDate(matched);
    if (picked) return picked;
    const fallback = pickClienteByBirthDate(clientes);
    if (fallback) return fallback;
  }

  let page = 1;
  while (page <= TEST_SEARCH_PAGES) {
    const response = await client.listClientes(page);
    const clientes = response.data || [];
    for (const cliente of clientes) {
      const phone =
        normalizePhone(cliente.celular) || normalizePhone(cliente.telefone);
      if (phone && phone === targetPhone) {
        return cliente;
      }
    }
    page += 1;
  }
  return null;
};

const upsertContact = async (
  companyId: number,
  cliente: GestaoClickCliente
): Promise<TestResult> => {
  const phone =
    normalizePhone(cliente.celular) || normalizePhone(cliente.telefone);
  if (!phone) {
    return { updated: false, created: false, message: "Telefone inválido." };
  }

  const birthDate = parseBirthDate(cliente.data_nascimento);
  const normalizedName = normalizeName(cliente.nome);
  const contact = await Contact.findOne({ where: { number: phone, companyId } });

  if (!contact) {
    if (!birthDate) {
      return {
        updated: false,
        created: false,
        message: "Contato não encontrado e data de nascimento inválida.",
        clienteId: cliente.id
      };
    }
    const created = await CreateContactService({
      name: normalizedName || phone,
      number: phone,
      companyId,
      birthDate
    });
    return {
      updated: false,
      created: true,
      message: "Contato criado com sucesso.",
      contactId: created.id,
      clienteId: cliente.id
    };
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

  if (Object.keys(updates).length === 0) {
    return {
      updated: false,
      created: false,
      message: "Nenhuma atualização necessária.",
      contactId: contact.id,
      clienteId: cliente.id
    };
  }

  await contact.update(updates);
  return {
    updated: true,
    created: false,
    message: "Contato atualizado com sucesso.",
    contactId: contact.id,
    clienteId: cliente.id
  };
};

const TestGestaoClickContactService = async (
  integrationId: string,
  companyId: number,
  testNumber: string
): Promise<TestResult> => {
  const integration = await ShowQueueIntegrationService(integrationId, companyId);
  if (integration.type !== "gestaoclick") {
    return {
      updated: false,
      created: false,
      message: "Integração não é do tipo Gestao Click."
    };
  }

  const cfg = parseConfig(integration.jsonContent);
  const accessToken = cfg.gcAccessToken;
  const secretToken = cfg.gcSecretToken;
  const baseUrl = cfg.gcBaseUrl || DEFAULT_BASE_URL;

  if (!accessToken || !secretToken) {
    return {
      updated: false,
      created: false,
      message: "Tokens da Gestao Click não configurados."
    };
  }

  const normalizedTest = normalizePhone(testNumber);
  if (!normalizedTest) {
    return {
      updated: false,
      created: false,
      message: "Número de teste inválido."
    };
  }

  const client = new GestaoClickClient({
    baseUrl,
    accessToken,
    secretToken
  });

  const cliente = await findClienteByPhone(client, normalizedTest);
  if (!cliente) {
    return {
      updated: false,
      created: false,
      message: "Cliente não encontrado na Gestao Click."
    };
  }

  return upsertContact(companyId, cliente);
};

export default TestGestaoClickContactService;
