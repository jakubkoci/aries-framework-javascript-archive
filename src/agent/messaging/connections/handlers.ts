import { InboundMessage } from '../../types';
import { ConnectionService } from './ConnectionService';
import { ConsumerRoutingService } from '../routing/ConsumerRoutingService';

export function handleInvitation(connectionService: ConnectionService, routingService: ConsumerRoutingService) {
  return async (inboundMessage: InboundMessage) => {
    const invitation = inboundMessage.message;
    const outboundMessage = await connectionService.acceptInvitation(invitation);

    const { verkey } = outboundMessage.connection;
    routingService.createRoute(verkey);

    return outboundMessage;
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
    const outboudMessage = await connectionService.acceptResponse(inboundMessage);
    return outboudMessage;
  };
}

export function handleAckMessage(connectionService: ConnectionService) {
  return async (inboundMessage: InboundMessage) => {
    const outboundMessage = await connectionService.acceptAck(inboundMessage);
    return outboundMessage;
  };
}
