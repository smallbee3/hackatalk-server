import { Message, MessagePayload, Resolvers } from '../generated/graphql';
import sequelize, { Op } from 'sequelize';

import { ChannelType } from '../models/Channel';
import { ErrorString } from '../../src/utils/error';
import { MessageType } from '../models/Message';
import { checkAuth } from '../utils/auth';

const resolver: Resolvers = {
  Mutation: {
    createMessage: async (_, args, { verifyUser, models }): Promise<MessagePayload> => {
      const { users, message, channelId } = args;
      const {
        Message: messageModel,
        Channel: channelModel,
        Membership: membershipModel,
      } = models;

      if (!args.message) throw ErrorString.MesssageIsEmpty;
      if (!args.users || args.users.length === 0) throw ErrorString.UsersAreEmpty;

      const auth = verifyUser();
      checkAuth(auth);

      try {
        const addMessage = (channelId: string): Promise<Message> => {
          return messageModel.create({
            type: MessageType.Text,
            text: message,
            channelId,
            userId: auth.userId,
          });
        };

        if (channelId) {
          return {
            channelId,
            message: await addMessage(channelId),
          };
        }

        const authUsers = [...new Set([...users, auth.userId])];
        const channels = await channelModel.findAll({
          group: ['channelId'],
          having: sequelize.where(
            sequelize.fn('COUNT', sequelize.col('channelId')),
            { [Op.in]: [authUsers.length] },
          ),
          include: [
            {
              model: membershipModel,
              as: 'memberships',
              where: {
                userId: authUsers,
              },
              attributes: [
                'channelId',
              ],
            },
          ],
          raw: true,
        });

        const channelIds = [];
        channels.forEach((channel) => channelIds.push(channel.id));

        const channels2 = await channelModel.findAll({
          having: sequelize.where(
            sequelize.fn('COUNT', sequelize.col('channelId')),
            { [Op.in]: [authUsers.length] },
          ),
          group: ['channelId'],
          attributes: [
            'memberships.channelId',
            [sequelize.fn('COUNT', sequelize.col('channelId')), 'numOfMemberships'],
          ],
          where: {
            id: channelIds,
          },
          include: [
            {
              model: membershipModel,
              as: 'memberships',
              attributes: [
                'channelId',
              ],
            },
          ],
          raw: true,
        });

        let retrievedChannelId = channels2[0] ? channels2[0]['channelId'] : null;

        if (!retrievedChannelId) {
          const channel = await channelModel.create(
            {
              type: ChannelType.Private,
              name: '',
            },
          );

          retrievedChannelId = channel.getDataValue('id');

          const membershipPromises = [];

          authUsers.forEach((user, index) => {
            membershipPromises[index++] = membershipModel.create({
              channelId: retrievedChannelId,
              userId: user,
            });
          });

          await Promise.all(membershipPromises);
        }

        return {
          channelId: retrievedChannelId,
          message: await addMessage(retrievedChannelId),
        };
      } catch (err) {
        throw new Error(err);
      }
    },
  },
};

export default resolver;
