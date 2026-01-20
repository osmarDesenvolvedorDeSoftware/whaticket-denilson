import axios, { AxiosError } from "axios";
import logger from "../../../utils/logger";

export interface GestaoClickMeta {
  total_registros?: number;
  total_paginas?: number;
  total_registros_pagina?: number;
  pagina_atual?: number;
  limite_por_pagina?: number;
  proxima_pagina?: number | null;
}

export interface GestaoClickCliente {
  id: string;
  nome: string;
  data_nascimento: string;
  telefone: string;
  celular: string;
  email?: string;
  ativo?: string;
}

export interface GestaoClickResponse {
  code: number;
  status: string;
  meta: GestaoClickMeta;
  data: GestaoClickCliente[];
}

export interface GestaoClickConfig {
  baseUrl: string;
  accessToken: string;
  secretToken: string;
}

const normalizeBaseUrl = (url: string): string => {
  return String(url || "").trim().replace(/\/+$/, "");
};

export class GestaoClickClient {
  private baseUrl: string;
  private accessToken: string;
  private secretToken: string;

  constructor(config: GestaoClickConfig) {
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.accessToken = config.accessToken;
    this.secretToken = config.secretToken;
  }

  async listClientes(pagina: number): Promise<GestaoClickResponse> {
    try {
      const { data } = await axios.get<GestaoClickResponse>(
        `${this.baseUrl}/clientes`,
        {
          params: { pagina },
          headers: {
            "access-token": this.accessToken,
            "secret-access-token": this.secretToken
          }
        }
      );
      return data;
    } catch (error) {
      const err = error as AxiosError;
      logger.error(
        { err: err?.message, url: this.baseUrl, pagina },
        "GestaoClick listClientes error"
      );
      throw error;
    }
  }

  async listClientesByTelefone(telefone: string): Promise<GestaoClickResponse> {
    try {
      const { data } = await axios.get<GestaoClickResponse>(
        `${this.baseUrl}/clientes`,
        {
          params: { telefone },
          headers: {
            "access-token": this.accessToken,
            "secret-access-token": this.secretToken
          }
        }
      );
      return data;
    } catch (error) {
      const err = error as AxiosError;
      logger.error(
        { err: err?.message, url: this.baseUrl, telefone },
        "GestaoClick listClientesByTelefone error"
      );
      throw error;
    }
  }
}

export default GestaoClickClient;
