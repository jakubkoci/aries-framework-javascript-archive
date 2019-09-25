import uuid from 'uuid/v4';
import { Connection } from '../../types';

export enum MessageType {
  RouteUpdateMessage = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/routecoordination/1.0/keylist_update',
  ForwardMessage = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/routing/1.0/forward',
}

export function createRouteUpdateMessage(connection: Connection, recipientKey: Verkey) {
  const routeUpdateMessage = {
    '@id': uuid(),
    '@type': MessageType.RouteUpdateMessage,
    updates: [
      {
        recipient_key: recipientKey,
        action: 'add', // "add" or "remove"
      },
    ],
  };

  if (!connection.endpoint || !connection.theirKey) {
    throw new Error('Invalid connection endpoint');
  }

  const outboundMessage = {
    connection,
    endpoint: connection.endpoint,
    payload: routeUpdateMessage,
    recipientKeys: [connection.theirKey],
    routingKeys: [],
    senderVk: connection.verkey,
  };

  return outboundMessage;
}

export function createForwardMessage(to: Verkey, msg: any) {
  const forwardMessage = {
    '@type': MessageType.ForwardMessage,
    to,
    msg,
  };
  return forwardMessage;
}
