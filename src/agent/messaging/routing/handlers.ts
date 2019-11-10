import { InboundMessage } from '../../types';
import { ConnectionService } from '../connections/ConnectionService';
import { ProviderRoutingService } from './ProviderRoutingService';

export function handleRouteUpdateMessage(connectionService: ConnectionService, routingService: ProviderRoutingService) {
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

export function handleForwardMessage(routingService: ProviderRoutingService) {
  return async (inboundMessage: InboundMessage) => {
    const outboundMessage = routingService.forward(inboundMessage);
    return outboundMessage;
  };
}
