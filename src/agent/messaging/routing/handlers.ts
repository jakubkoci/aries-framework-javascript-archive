import { InboundMessage } from '../../types';
import { ConnectionService } from '../connections/ConnectionService';
import { RoutingService } from './RoutingService';
import { createOutboundMessage } from '../helpers';

export function handleRouteUpdateMessage(connectionService: ConnectionService, routingService: RoutingService) {
  return async (inboundMessage: InboundMessage) => {
    const { message, recipient_verkey, sender_verkey } = inboundMessage;
    const connection = connectionService.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    const outboundMessage = routingService.updateRoutes(inboundMessage, connection);
    return outboundMessage;
  };
}

export function handleForwardMessage(routingService: RoutingService) {
  return async (inboundMessage: InboundMessage) => {
    const outboundMessage = routingService.forward(inboundMessage)
    return outboundMessage
  };
}
