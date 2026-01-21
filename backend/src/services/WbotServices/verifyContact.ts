import { Mutex } from "async-mutex";
import { Op } from "sequelize";
import Contact from "../../models/Contact";
import CreateOrUpdateContactService, {
  updateContact
} from "../ContactServices/CreateOrUpdateContactService";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import WhatsappLidMap from "../../models/WhatsapplidMap";
// Importar o módulo inteiro para acessar a fila
import * as queues from "../../queues";
import logger from "../../utils/logger";
import { IMe } from "./wbotMessageListener";
import { Session } from "../../libs/wbot";

const lidUpdateMutex = new Mutex();

export async function checkAndDedup(
  contact: Contact,
  lid: string
): Promise<void> {
  const lidContact = await Contact.findOne({
    where: {
      companyId: contact.companyId,
      number: {
        [Op.or]: [lid, lid.substring(0, lid.indexOf("@"))]
      }
    }
  });

  if (!lidContact) {
    return;
  }

  await Message.update(
    { contactId: contact.id },
    {
      where: {
        contactId: lidContact.id,
        companyId: contact.companyId
      }
    }
  );

  const allTickets = await Ticket.findAll({
    where: {
      contactId: lidContact.id,
      companyId: contact.companyId
    }
  });

  // Transfer all tickets to main contact instead of closing them
  await Ticket.update(
    { contactId: contact.id },
    {
      where: {
        contactId: lidContact.id,
        companyId: contact.companyId
      }
    }
  );

  if (allTickets.length > 0) {
    console.log(`[RDS CONTATO] Transferidos ${allTickets.length} tickets do contato ${lidContact.id} para ${contact.id}`);
  }

  // Delete the duplicate contact after transferring all data
  await lidContact.destroy();
}

export async function verifyContact(
  msgContact: IMe,
  wbot: Session,
  companyId: number
): Promise<Contact> {
  let profilePicUrl: string;



  // try {
  //   profilePicUrl = await wbot.profilePictureUrl(msgContact.id);
  // } catch (e) {
  //   profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
  // }

  const isLid = msgContact.id.includes("@lid") || false;
  console.log("[DEBUG RODRIGO] isLid", isLid)
  const isGroup = msgContact.id.includes("@g.us");
  const isWhatsappNet = msgContact.id.includes("@s.whatsapp.net");

  // Extrair o número do ID
  const idParts = msgContact.id.split('@');
  const extractedId = idParts[0];

  // Extrair qualquer número de telefone adicional que possa estar presente
  const extractedPhone = extractedId.split(':')[0]; // Remove parte após ":" se existir

  // Determinar n?mero e LID adequadamente
  const senderPnNumber = msgContact.senderPn
    ? msgContact.senderPn.replace(/\D/g, "")
    : "";
  let originalLid = msgContact.lid || null;
  const lidJid = isLid ? (originalLid || msgContact.id) : null;
  const lidNumber = lidJid ? lidJid.split("@")[0] : "";
  let number = extractedPhone;
  if (isLid && senderPnNumber) {
    number = senderPnNumber;
  }
  console.log("[DEBUG RODRIGO] number", number)
  console.log("[DEBUG RODRIGO] originalLid", originalLid)

  // Se o ID estiver no formato telefone:XX@s.whatsapp.net, extraia apenas o telefone
  if (isWhatsappNet && extractedId.includes(':')) {
    logger.info(`[RDS-LID-FIX] ID contém separador ':' - extraindo apenas o telefone: ${extractedPhone}`);
  }

  // Verificar se o "número" parece ser um LID (muito longo para ser telefone)
  const isNumberLikelyLid = !isLid && number && number.length > 15 && !isGroup;
  if (isNumberLikelyLid) {
    logger.info(`[RDS-LID-FIX] Número extraído parece ser um LID (muito longo): ${number}`);
  }

  logger.info(`[RDS-LID-FIX] Processando contato - ID original: ${msgContact.id}, número extraído: ${number}, LID detectado: ${originalLid || "não"}`);

  const contactData = {
    name: msgContact?.name || msgContact.id.replace(/\D/g, ""),
    number,
    profilePicUrl,
    isGroup,
    companyId,
    lid: lidJid || originalLid // Adicionar o LID aos dados do contato quando dispon?vel
  };

  if (isGroup) {
    return CreateOrUpdateContactService(contactData);
  }

  return lidUpdateMutex.runExclusive(async () => {
    let foundContact: Contact | null = null;
    if (isLid) {
      console.log("[DEBUG RODRIGO] isLid", JSON.stringify(msgContact, null, 2))
      if (senderPnNumber) {
        foundContact = await Contact.findOne({
          where: {
            companyId,
            number: senderPnNumber
          },
          include: ["tags", "extraInfo", "whatsappLidMap"]
        });
      }
      if (!foundContact) {
        foundContact = await Contact.findOne({
          where: {
            companyId,
            [Op.or]: [
              { lid: lidJid ? lidJid : msgContact.id },
              { number: lidNumber },
              { remoteJid: lidJid ? lidJid : msgContact.id }
            ]
          },
          include: ["tags", "extraInfo", "whatsappLidMap"]
        });
      }
    } else {
      console.log("[DEBUG RODRIGO] No isLid", JSON.stringify(msgContact, null, 2))
      foundContact = await Contact.findOne({
        where: {
          companyId,
          number: number
        },
      });
    }
    console.log("[DEBUG RODRIGO] foundContact", foundContact?.id)
    if (isLid) {
      if (foundContact) {
        if (lidJid) {
          await checkAndDedup(foundContact, lidJid);
          if (foundContact.lid !== lidJid) {
            await foundContact.update({ lid: lidJid });
          }
          const lidMap = await WhatsappLidMap.findOne({
            where: {
              companyId,
              lid: lidJid,
              contactId: foundContact.id
            }
          });
          if (!lidMap) {
            await WhatsappLidMap.create({
              companyId,
              lid: lidJid,
              contactId: foundContact.id
            });
          }
        }
        return updateContact(foundContact, {
          profilePicUrl: contactData.profilePicUrl
        });
      }

      const foundMappedContact = await WhatsappLidMap.findOne({
        where: {
          companyId,
          lid: lidJid ? lidJid : msgContact.id
        },
        include: [
          {
            model: Contact,
            as: "contact",
            include: ["tags", "extraInfo"]
          }
        ]
      });

      if (foundMappedContact) {
        return updateContact(foundMappedContact.contact, {
          profilePicUrl: contactData.profilePicUrl
        });
      }

      const partialLidContact = await Contact.findOne({
        where: {
          companyId,
          number: lidNumber
        },
        include: ["tags", "extraInfo"]
      });

      if (partialLidContact) {
        return updateContact(partialLidContact, {
          number: contactData.number,
          profilePicUrl: contactData.profilePicUrl
        });
      }
    } else if (foundContact) {
      if (!foundContact.whatsappLidMap) {
        try {

          const ow = await wbot.onWhatsApp(msgContact.id);

          if (ow?.[0]?.exists) {
            const lid = ow?.[0]?.lid as string;


            if (lid) {
              await checkAndDedup(foundContact, lid);

              const lidMap = await WhatsappLidMap.findOne({
                where: {
                  companyId,
                  lid,
                  contactId: foundContact.id
                }
              });
              if (!lidMap) {
                await WhatsappLidMap.create({
                  companyId,
                  lid,
                  contactId: foundContact.id
                });
              }
              logger.info(`[RDS CONTATO] LID obtido para contato ${foundContact.id} (${msgContact.id}): ${lid}`);
            }
          } else {
            logger.warn(`[RDS CONTATO] Contato ${msgContact.id} não encontrado no WhatsApp, mas continuando processamento`);
          }
        } catch (error) {
          console.log("[DEBUG RODRIGO] error", JSON.stringify(error, null, 2))
          logger.error(`[RDS CONTATO] Erro ao verificar contato ${msgContact.id} no WhatsApp: ${error.message}`);

          try {
            await queues["lidRetryQueue"].add(
              "RetryLidLookup",
              {
                contactId: foundContact.id,
                whatsappId: wbot.id || null,
                companyId,
                number: msgContact.id,
                retryCount: 1,
                maxRetries: 5
              },
              {
                delay: 60 * 1000, // 1 minuto
                attempts: 1,
                removeOnComplete: true
              }
            );
            logger.info(`[RDS CONTATO] Agendada retentativa de obtenção de LID para contato ${foundContact.id} (${msgContact.id})`);
          } catch (queueError) {
            logger.error(`[RDS CONTATO] Erro ao adicionar contato ${foundContact.id} à fila de retentativa: ${queueError.message}`);
          }
        }
      }
      return updateContact(foundContact, {
        profilePicUrl: contactData.profilePicUrl
      });
    } else if (!isGroup && !foundContact) {
      let newContact: Contact | null = null;

      try {



        const ow = await wbot.onWhatsApp(msgContact.id);




        if (!ow?.[0]?.exists) {



          if (originalLid && !contactData.lid) {

            contactData.lid = originalLid;
          }


          return CreateOrUpdateContactService(contactData);
        }




        let lid = ow?.[0]?.lid as string;


        if (!lid && originalLid) {
          lid = originalLid;

        }


        try {
          const firstItem = ow && ow.length > 0 ? ow[0] : null;
          if (firstItem) {
            const firstItemAny = firstItem as any;
            if (firstItemAny.jid) {
              const parts = String(firstItemAny.jid).split('@');
              if (parts.length > 0) {
                const owNumber = parts[0];
                if (owNumber && owNumber !== number) {

                }
              }
            }
          }
        } catch (e) {
          logger.error(`[RDS-LID-FIX] Erro ao extrair número da resposta onWhatsApp: ${e.message}`);
        }



        if (lid) {

          const lidContact = await Contact.findOne({
            where: {
              companyId,
              number: {
                [Op.or]: [lid, lid.substring(0, lid.indexOf("@"))]
              }
            },
            include: ["tags", "extraInfo"]
          });

          if (lidContact) {
            // Atualiza o campo lid no contato além de criar o mapeamento
            await lidContact.update({
              lid: lid
            });

            await WhatsappLidMap.create({
              companyId,
              lid,
              contactId: lidContact.id
            });

            return updateContact(lidContact, {
              number: contactData.number,
              profilePicUrl: contactData.profilePicUrl
            });
          } else {
            const contactDataWithLid = {
              ...contactData,
              lid: lid
            };
            newContact = await CreateOrUpdateContactService(contactDataWithLid);


            if (newContact.lid !== lid) {
              await newContact.update({ lid: lid });

            }

            await WhatsappLidMap.create({
              companyId,
              lid,
              contactId: newContact.id
            });

            return newContact;
          }
        }
      } catch (error) {
        console.log("[DEBUG RODRIGO] error", JSON.stringify(error, null, 2))
        logger.error(`[RDS CONTATO] Erro ao verificar contato ${msgContact.id} no WhatsApp: ${error.message}`);

        newContact = await CreateOrUpdateContactService(contactData);
        logger.info(`[RDS CONTATO] Contato criado sem LID devido a erro: ${newContact.id}`);

        try {
          await queues["lidRetryQueue"].add(
            "RetryLidLookup",
            {
              contactId: newContact.id,
              whatsappId: wbot.id || null,
              companyId,
              number: msgContact.id,
              lid: originalLid ? originalLid : msgContact.id,
              retryCount: 1,
              maxRetries: 5
            },
            {
              delay: 60 * 1000, // 1 minuto
              attempts: 1,
              removeOnComplete: true
            }
          );
          logger.info(`[RDS CONTATO] Agendada retentativa de obtenção de LID para novo contato ${newContact.id} (${msgContact.id})`);
        } catch (queueError) {
          logger.error(`[RDS CONTATO] Erro ao adicionar contato ${newContact.id} à fila de retentativa: ${queueError.message}`);
        }

        return newContact;
      }
    }

    return CreateOrUpdateContactService(contactData);
  });
}
