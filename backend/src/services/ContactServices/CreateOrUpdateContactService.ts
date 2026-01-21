// src/services/ContactServices/CreateOrUpdateContactService.ts - CORRIGIDO
import { getIO } from "../../libs/socket";
import CompaniesSettings from "../../models/CompaniesSettings";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import fs from "fs";
import path, { join } from "path";
import logger from "../../utils/logger";
import { isNil } from "lodash";
import Whatsapp from "../../models/Whatsapp";
import * as Sentry from "@sentry/node";
import { ENABLE_LID_DEBUG } from "../../config/debug";
import { normalizeJid } from "../../utils";
import { isInvalidContactName, resolveBestContactName } from "../../utils/contactName";
const axios = require("axios");

interface ExtraInfo extends ContactCustomField {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  isGroup: boolean;
  email?: string;
  birthDate?: Date | string; // 🎂 NOVO CAMPO ADICIONADO
  profilePicUrl?: string;
  companyId: number;
  channel?: string;
  extraInfo?: ExtraInfo[];
  remoteJid?: string;
  lid?: string;
  whatsappId?: number;
  wbot?: any;
  fromMe?: boolean;
}

interface ContactData {
  name?: string;
  number?: string;
  isGroup?: boolean;
  email?: string;
  profilePicUrl?: string;
  companyId?: number;
  extraInfo?: ExtraInfo[];
  channel?: string;
  disableBot?: boolean;
  language?: string;
  lid?: string;
}

export const updateContact = async (
  contact: Contact,
  contactData: ContactData
) => {
  await contact.update(contactData);

  const io = getIO();
  io.to(`company-${contact.companyId}-mainchannel`).emit(
    `company-${contact.companyId}-contact`,
    {
      action: "update",
      contact
    }
  );
  return contact;
};

const CreateOrUpdateContactService = async ({
  name,
  number,
  // number: rawNumber,
  profilePicUrl,
  isGroup,
  email = "",
  birthDate = null, // 🎂 INCLUIR NO DESTRUCTURING
  channel = "whatsapp",
  companyId,
  extraInfo = [],
  remoteJid = "",
  lid = "",
  whatsappId,
  wbot,
  fromMe = false
}: Request): Promise<Contact> => {

  // console.log('number', number)
  // console.log('remoteJid', remoteJid)
  // console.log('isGroup', isGroup)
  // console.log('number', number)

  try {
    // Garantir que o número esteja no formato correto (sem @lid)
    let cleanNumber = number;
    if (!isGroup && cleanNumber.includes('@')) {
      cleanNumber = cleanNumber.substring(0, cleanNumber.indexOf('@'));
      logger.info(`[RDS-LID] Número com formato incorreto corrigido: ${number} -> ${cleanNumber}`);
    }

    // Monta um remoteJid padrão quando não for informado
    const fallbackRemoteJid = normalizeJid(
      remoteJid || (isGroup ? `${cleanNumber}@g.us` : `${cleanNumber}@s.whatsapp.net`)
    );

    let contactName = name;
    if (!isGroup && isInvalidContactName(contactName)) {
      contactName = resolveBestContactName({
        pushName: contactName,
        integrationName: contactName,
        profileName: contactName,
        number: cleanNumber
      });
    }

    let createContact = false;
    const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

    const io = getIO();
    let contact: Contact | null;

    if (ENABLE_LID_DEBUG) {
      logger.info(
        `[RDS-LID] Buscando contato: number=${cleanNumber}, companyId=${companyId}, lid=${lid}`
      );
    }
    if (lid) {
      contact = await Contact.findOne({ where: { lid, companyId } });
    }
    if (!contact) {
      contact = await Contact.findOne({ where: { number: cleanNumber, companyId } });
    }

    let updateImage =
      ((!contact ||
        (contact?.profilePicUrl !== profilePicUrl && profilePicUrl !== "")) &&
        (wbot || ["instagram", "facebook"].includes(channel))) ||
      false;

    if (contact) {
      // if (ENABLE_LID_DEBUG) {
      //   logger.info(
      //     `[RDS-LID] Contato encontrado: id=${contact.id}, number=${contact.number}, jid=${contact.remoteJid}, lid=${contact.lid}`
      //   );
      // }
      contact.remoteJid = fallbackRemoteJid;
      if (!contact.lid) {
        contact.lid = lid;
      }
      if (ENABLE_LID_DEBUG) {
        logger.info(`[RDS-LID] fromMe recebido: ${fromMe}`);
      }

      // Atualizar LID quando disponível
      if (lid && lid !== "") {
        if (contact.lid !== lid) {
          if (ENABLE_LID_DEBUG) {
            logger.info(
              `[RDS-LID] Atualizando lid do contato: de='${contact.lid}' para='${lid}'`
            );
          }
          contact.lid = lid;
        }
      } else if (fromMe === false && contact.lid && fallbackRemoteJid) {
        // Se não temos lid mas temos um remoteJid, tenta obter o lid do whatsapp
        if (wbot) {
          try {
            const ow = await wbot.onWhatsApp(fallbackRemoteJid);
            if (ow?.[0]?.exists && ow?.[0]?.lid) {
              const lidFromLookup = ow[0].lid as string;
              if (lidFromLookup && lidFromLookup !== contact.lid) {
                if (ENABLE_LID_DEBUG) {
                  logger.info(
                    `[RDS-LID] Atualizando lid obtido via lookup: de='${contact.lid}' para='${lidFromLookup}'`
                  );
                }
                contact.lid = lidFromLookup;
              }
            }
          } catch (error) {
            if (ENABLE_LID_DEBUG) {
              logger.error(`[RDS-LID] Erro ao consultar LID: ${error.message}`);
            }
          }
        }
      }
      contact.profilePicUrl = profilePicUrl || null;
      contact.isGroup = isGroup;

      // 🎂 ATUALIZAR DATA DE NASCIMENTO SE FORNECIDA
      if (birthDate !== null && birthDate !== undefined) {
        let processedBirthDate: Date | null = null;
        if (typeof birthDate === "string") {
          processedBirthDate = new Date(birthDate);
          // Validar se a data é válida
          if (!isNaN(processedBirthDate.getTime())) {
            contact.birthDate = processedBirthDate;
          }
        } else {
          contact.birthDate = birthDate;
        }
      }

      if (isNil(contact.whatsappId) && !isNil(whatsappId)) {
        const whatsapp = await Whatsapp.findOne({
          where: { id: whatsappId, companyId }
        });

        if (whatsapp) {
          contact.whatsappId = whatsappId;
        }
      }

      const folder = path.resolve(
        publicFolder,
        `company${companyId}`,
        "contacts"
      );

      let fileName,
        oldPath = "";
      if (contact.urlPicture) {
        oldPath = path.resolve(contact.urlPicture.replace(/\\/g, "/"));
        fileName = path.join(folder, oldPath.split("\\").pop());
      }
      if (
        !fs.existsSync(fileName) ||
        (contact.profilePicUrl === "" && channel === "whatsapp")
      ) {
        try {
          const targetJid = contact.remoteJid || fallbackRemoteJid;
          profilePicUrl = await wbot.profilePictureUrl(targetJid, "image");
        } catch (e) {
          profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
        }
        contact.profilePicUrl = profilePicUrl;
        updateImage = true;
      }

      if (!isGroup && isInvalidContactName(contact.name)) {
        const bestName = resolveBestContactName({
          pushName: contactName,
          integrationName: contactName,
          profileName: contactName,
          number: cleanNumber
        });
        if (!isInvalidContactName(bestName) && contact.name !== bestName) {
          contact.name = bestName;
        }
      }

      await contact.save(); // Ensure save() is called to trigger updatedAt
      await contact.reload();
      // if (ENABLE_LID_DEBUG) {
      //   logger.info(
      //     `[RDS-LID] Contato atualizado: id=${contact.id}, number=${contact.number}, jid=${contact.remoteJid}, lid=${contact.lid}`
      //   );
      // }
    } else if (["whatsapp"].includes(channel)) {
      const settings = await CompaniesSettings.findOne({
        where: { companyId }
      });
      const acceptAudioMessageContact = settings?.acceptAudioMessageContact;
      const newRemoteJid = fallbackRemoteJid;

      // if (!remoteJid && remoteJid !== "") {
      //   newRemoteJid = isGroup
      //     ? `${rawNumber}@g.us`
      //     : `${rawNumber}@s.whatsapp.net`;
      // }

      if (ENABLE_LID_DEBUG) {
        logger.info(
          `[RDS-LID] Criando novo contato: number=${number}, jid=${newRemoteJid}, lid=${lid}`
        );
      }
      if (wbot) {
        try {
          profilePicUrl = await wbot.profilePictureUrl(newRemoteJid, "image");
        } catch (e) {
          profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
        }
      } else {
        profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
      }

      // 🎂 PROCESSAR DATA DE NASCIMENTO PARA NOVO CONTATO
      let processedBirthDate: Date | null = null;
      if (birthDate) {
        if (typeof birthDate === "string") {
          processedBirthDate = new Date(birthDate);
          // Validar se a data é válida
          if (isNaN(processedBirthDate.getTime())) {
            processedBirthDate = null;
          }
        } else {
          processedBirthDate = birthDate;
        }
      }

      try {
        // Verificar se conseguimos obter o LID via API do WhatsApp
        let lidToUse = lid || null;

        // Se não temos LID mas temos wbot, tenta consultar o LID via API
        if (!lidToUse && wbot && newRemoteJid) {
          try {
            const ow = await wbot.onWhatsApp(newRemoteJid);
            if (ow?.[0]?.exists && ow?.[0]?.lid) {
              lidToUse = ow[0].lid as string;
              if (ENABLE_LID_DEBUG) {
                logger.info(
                  `[RDS-LID] LID obtido via API para novo contato: ${lidToUse}`
                );
              }
            }
          } catch (error) {
            if (ENABLE_LID_DEBUG) {
              logger.error(`[RDS-LID] Erro ao consultar LID para novo contato: ${error.message}`);
            }
          }
        }

        // Criando contato com LID quando disponível
        contact = await Contact.create({
          name: contactName,
          number: cleanNumber, // Usar o número limpo aqui
          email,
          birthDate: processedBirthDate, // 🎂 INCLUIR NO CREATE
          isGroup,
          companyId,
          channel,
          acceptAudioMessage:
            acceptAudioMessageContact === "enabled" ? true : false,
          remoteJid: normalizeJid(newRemoteJid),
          lid: lidToUse, // Usa o LID obtido da API ou o passado no parâmetro
          profilePicUrl,
          urlPicture: "",
          whatsappId
        });
        if (ENABLE_LID_DEBUG) {
          logger.info(
            `[RDS-LID] Novo contato criado: id=${contact.id}, number=${contact.number}, jid=${contact.remoteJid}, lid=${contact.lid}`
          );
        }
        createContact = true;
      } catch (err) {
        // Verificar se é erro de unicidade (contato já existe)
        if (err.name === 'SequelizeUniqueConstraintError') {
          logger.info(`[RDS-CONTACT] Contato já existe, buscando e reativando: number=${number}, companyId=${companyId}`);

          // Buscar o contato existente que pode estar inativo
          contact = await Contact.findOne({
            where: {
              number,
              companyId
            }
          });

          if (contact) {
            // Reativar o contato se estiver inativo
            if (!contact.active) {
              await contact.update({
                active: true,
                profilePicUrl,
                remoteJid: normalizeJid(newRemoteJid),
                lid: lid || null
              });

              logger.info(`[RDS-CONTACT] Contato reativado: id=${contact.id}, number=${contact.number}`);
            }
          } else {
            // Caso muito improvável - erro de unicidade, mas contato não encontrado
            logger.error(`[RDS-CONTACT] Erro de unicidade, mas contato não encontrado: ${err.message}`);
            throw err;
          }
        } else {
          // Outros erros são repassados
          logger.error(`[RDS-CONTACT] Erro ao criar contato: ${err.message}`);
          throw err;
        }
      }
    } else if (["facebook", "instagram"].includes(channel)) {
      // 🎂 PROCESSAR DATA DE NASCIMENTO PARA REDES SOCIAIS - CORREÇÃO DE TIMEZONE
      let processedBirthDate: Date | null = null;
      if (birthDate) {
        if (typeof birthDate === "string") {
          // Se vier no formato ISO, extrair apenas a parte da data
          const dateOnly = birthDate.split('T')[0];
          // Criar data local com meio-dia para evitar problemas de timezone
          const [year, month, day] = dateOnly.split('-').map(Number);
          processedBirthDate = new Date(year, month - 1, day, 12, 0, 0);
        } else if (birthDate instanceof Date) {
          // Se for objeto Date, criar nova data local com meio-dia
          const year = birthDate.getFullYear();
          const month = birthDate.getMonth();
          const day = birthDate.getDate();
          processedBirthDate = new Date(year, month, day, 12, 0, 0);
        }
      }

      try {
        contact = await Contact.create({
          name: contactName,
          number: cleanNumber, // Usar o número limpo aqui
          email,
          birthDate: processedBirthDate, // 🎂 INCLUIR NO CREATE
          isGroup,
          companyId,
          channel,
          profilePicUrl,
          urlPicture: "",
          whatsappId
        });
        createContact = true;
      } catch (err) {
        // Verificar se é erro de unicidade (contato já existe)
        if (err.name === 'SequelizeUniqueConstraintError') {
          logger.info(`[RDS-CONTACT] Contato social já existe, buscando e reativando: number=${number}, companyId=${companyId}, canal=${channel}`);

          // Buscar o contato existente que pode estar inativo
          contact = await Contact.findOne({
            where: {
              number: cleanNumber, // Usar o número limpo aqui
              companyId,
              channel
            }
          });

          if (contact) {
            // Reativar o contato se estiver inativo
            if (!contact.active) {
              await contact.update({
                active: true,
                profilePicUrl
              });

              logger.info(`[RDS-CONTACT] Contato social reativado: id=${contact.id}, number=${contact.number}, canal=${channel}`);
            }
          } else {
            // Caso muito improvável - erro de unicidade, mas contato não encontrado
            logger.error(`[RDS-CONTACT] Erro de unicidade no contato social, mas contato não encontrado: ${err.message}`);
            throw err;
          }
        } else {
          // Outros erros são repassados
          logger.error(`[RDS-CONTACT] Erro ao criar contato social: ${err.message}`);
          throw err;
        }
      }
    }

    // Se ainda não temos contato aqui, não prossiga para evitar null reference
    if (!contact) {
      throw new Error(
        "Não foi possível criar ou localizar o contato. Informe o número/canal corretamente."
      );
    }

    if (updateImage) {
      const folder = path.resolve(
        publicFolder,
        `company${companyId}`,
        "contacts"
      );

      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        fs.chmodSync(folder, 0o777);
      }

      let filename;
      if (isNil(profilePicUrl) || profilePicUrl.includes("nopicture")) {
        filename = "nopicture.png";
      } else {
        filename = `${contact.id}.jpeg`;
        const filePath = join(folder, filename);

        // Verifica se o arquivo já existe e se o profilePicUrl não mudou
        if (fs.existsSync(filePath) && contact.urlPicture === filename) {
          // Arquivo já existe e é o mesmo, não precisa baixar novamente
          updateImage = false;
        } else {
          // Remove arquivo antigo se existir
          if (!isNil(contact.urlPicture) && contact.urlPicture !== filename) {
            const oldPath = path.resolve(
              contact.urlPicture.replace(/\\/g, "/")
            );
            const oldFileName = path.join(folder, oldPath.split("\\").pop());

            if (fs.existsSync(oldFileName)) {
              fs.unlinkSync(oldFileName);
            }
          }

          const response = await axios.get(profilePicUrl, {
            responseType: "arraybuffer"
          });

          // Save the image to the directory
          fs.writeFileSync(filePath, response.data);
        }
      }

      // Atualiza o contato apenas se a imagem mudou ou se não tinha urlPicture
      if (updateImage || isNil(contact.urlPicture)) {
        await contact.update({
          urlPicture: filename,
          pictureUpdated: true
        });

        await contact.reload();
      }
    }

    if (createContact) {
      io.of(String(companyId)).emit(`company-${companyId}-contact`, {
        action: "create",
        contact
      });
    } else {
      io.of(String(companyId)).emit(`company-${companyId}-contact`, {
        action: "update",
        contact
      });
    }

    if (ENABLE_LID_DEBUG) {
      logger.info(
        `[RDS-LID] Retornando contato: { jid: '${contact.remoteJid}', exists: true, lid: '${contact.lid}' }`
      );
    }
    return contact;
  } catch (err) {
    logger.error("Error to find or create a contact:", err);
    throw err;
  }
};

export default CreateOrUpdateContactService;
