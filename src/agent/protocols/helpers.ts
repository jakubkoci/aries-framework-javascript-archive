import { Connection, Message } from '../types';

export function createOutboundMessage(connection: Connection, payload: Message, invitation?: any) {
  if (invitation) {
    return {
      connection,
      endpoint: invitation.serviceEndpoint,
      payload,
      recipientKeys: invitation.recipientKeys,
      routingKeys: invitation.routingKeys,
      senderVk: null,
    };
  }

  const { theirDidDoc } = connection;

  if (!theirDidDoc) {
    throw new Error(`DidDoc for connection with verkey ${connection.verkey} not found!`);
  }

  return {
    connection,
    endpoint: theirDidDoc.service[0].serviceEndpoint,
    payload,
    recipientKeys: theirDidDoc.service[0].recipientKeys,
    routingKeys: theirDidDoc.service[0].routingKeys,
    senderVk: connection.verkey,
  };
}
