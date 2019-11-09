import { InboundMessage } from '../../types';
import { createAckMessage } from '../connections/messages';
import { ConnectionService } from '../connections/ConnectionService';
import { BasicMessageService } from './BasicMessageService';
import { createOutboundMessage } from '../helpers';

export function handleBasicMessage(connectionService: ConnectionService, basicMessageService: BasicMessageService) {
  return async (inboundMessage: InboundMessage) => {
    const { message, recipient_verkey, sender_verkey } = inboundMessage;
    const connection = connectionService.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    if (!connection.theirKey) {
      throw new Error(`Connection with verkey ${connection.verkey} has no recipient keys.`);
    }

    const outboundMessage = basicMessageService.save(inboundMessage, connection)
    return outboundMessage
  };
}
