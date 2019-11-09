import { InboundMessage } from '../../types';
import { ConnectionService } from './ConnectionService';

export function handleInvitation(connectionService: ConnectionService) {
  return async (inboundMessage: InboundMessage) => {
    const invitation = inboundMessage.message;
    const outboudMessage = connectionService.acceptInvitation(invitation);
    return outboudMessage;
  };
}

export function handleConnectionRequest(connectionService: ConnectionService) {
  return async (inboundMessage: InboundMessage) => {
    const outboudMessage = await connectionService.acceptRequest(inboundMessage);
    return outboudMessage;
  };
}

export function handleConnectionResponse(connectionService: ConnectionService) {
  return async (inboundMessage: InboundMessage) => {
    const outboudMessage = await connectionService.acceptResponse(inboundMessage)
    return outboudMessage
  };
}

export function handleAckMessage(connectionService: ConnectionService) {
  return async (inboundMessage: InboundMessage) => {
    const outboundMessage = await connectionService.acceptAck(inboundMessage)
    return outboundMessage
  };
}
