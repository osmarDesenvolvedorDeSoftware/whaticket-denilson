// Criar arquivo: DeleteAllContactsService.ts

import { Transaction } from "sequelize";
import sequelize from "../../database";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import ContactWallet from "../../models/ContactWallet";
import ContactTag from "../../models/ContactTag";
import AppError from "../../errors/AppError";
import { Op } from "sequelize";

interface Request {
  companyId: number;
  excludeIds?: number[];
}

const DeleteAllContactsService = async ({
  companyId,
  excludeIds = []
}: Request): Promise<number> => {
  const batchSize = 1000;
  let totalDeleted = 0;
  let lastId = 0;

  try {
    const whereCondition: any = { companyId };

    if (excludeIds.length > 0) {
      whereCondition.id = {
        [Op.notIn]: excludeIds
      };
    }

    while (true) {
      const batchWhere = {
        ...whereCondition,
        id: {
          ...(whereCondition.id || {}),
          [Op.gt]: lastId
        }
      };

      const contactsToDelete = await Contact.findAll({
        where: batchWhere,
        attributes: ["id"],
        order: [["id", "ASC"]],
        limit: batchSize
      });

      if (contactsToDelete.length === 0) {
        break;
      }

      const contactIds = contactsToDelete.map(contact => contact.id);
      lastId = contactIds[contactIds.length - 1];

      const transaction: Transaction = await sequelize.transaction();

      try {
        await ContactCustomField.destroy({
          where: {
            contactId: {
              [Op.in]: contactIds
            }
          },
          transaction
        });

        await ContactWallet.destroy({
          where: {
            contactId: {
              [Op.in]: contactIds
            },
            companyId
          },
          transaction
        });

        await ContactTag.destroy({
          where: {
            contactId: {
              [Op.in]: contactIds
            }
          },
          transaction
        });

        const deletedCount = await Contact.destroy({
          where: {
            companyId,
            id: {
              [Op.in]: contactIds
            }
          },
          transaction
        });

        await transaction.commit();
        totalDeleted += deletedCount;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    }

    if (totalDeleted === 0) {
      throw new AppError("No contacts found for deletion", 404);
    }

    return totalDeleted;
  } catch (error) {
    console.error("Error in DeleteAllContactsService:", error);

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("Failed to delete all contacts", 500);
  }
};

export default DeleteAllContactsService;