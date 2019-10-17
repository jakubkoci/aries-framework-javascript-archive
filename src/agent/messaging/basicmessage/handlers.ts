import { InboundMessage } from '../../types';
import { createAckMessage } from '../connections/messages';
import { ConnectionService } from '../connections/ConnectionService';
import { Context } from '../interface';

export function handleBasicMessage(connectionService: ConnectionService) {
  return async (inboundMessage: InboundMessage, context: Context) => {
    const { message, recipient_verkey, sender_verkey } = inboundMessage;
    const connection = connectionService.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    connection.messages.push(message);

    const response = createAckMessage(message['@id']);

    if (!connection.endpoint) {
      throw new Error('Invalid connection endpoint');
    }

    const outboundMessage = {
      connection,
      endpoint: connection.endpoint,
      payload: response,
      recipientKeys: [sender_verkey],
      routingKeys: connection.theirRoutingKeys || [],
      senderVk: connection.verkey,
    };

    return outboundMessage;
  };
}
