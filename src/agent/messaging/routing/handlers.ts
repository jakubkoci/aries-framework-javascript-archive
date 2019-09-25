import { InboundMessage } from '../../types';
import { ConnectionService } from '../connections/ConnectionService';
import { RoutingService } from './RoutingService';
import { Context } from '../interface';

type RouteUpdate = {
  action: 'add' | 'remove';
  recipient_key: Verkey;
};

export function handleRouteUpdateMessage(connectionService: ConnectionService, routingService: RoutingService) {
  return async (inboundMessage: InboundMessage, context: Context) => {
    const { message, recipient_verkey, sender_verkey } = inboundMessage;
    const connection = connectionService.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    message.updates.forEach((update: RouteUpdate) => {
      const { action, recipient_key } = update;
      if (action === 'add') {
        routingService.saveRoute(recipient_key, connection);
      } else {
        throw new Error(`Unsupported operation ${action}`);
      }
    });

    return null;
  };
}

export function handleForwardMessage(routingService: RoutingService) {
  return async (inboundMessage: InboundMessage, context: Context) => {
    const { message, recipient_verkey, sender_verkey } = inboundMessage;

    const { msg, to } = message;

    if (!to) {
      throw new Error('Invalid Message: Missing required attribute "to"');
    }

    const connection = routingService.findRecipient(to);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    if (!connection.theirKey) {
      throw new Error(`Connection with verkey ${connection.verkey} has no recipient keys.`);
    }

    const outboundMessage = {
      connection,
      endpoint: connection.endpoint,
      payload: msg,
      recipientKeys: [connection.theirKey],
      routingKeys: connection.didDoc.service[0].routingKeys,
      senderVk: connection.verkey,
    };

    return outboundMessage;
  };
}
