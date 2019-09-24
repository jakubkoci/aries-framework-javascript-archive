import uuid from 'uuid/v4';
import { Connection, InvitationDetails } from './types';

export enum MessageType {
  ConnectionInvitation = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/invitation',
  ConnectionRequest = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/request',
  ConnectionResposne = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/response',
  Ack = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/notification/1.0/ack',
  BasicMessage = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/basicmessage/1.0/message',
  RouteUpdateMessage = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/routecoordination/1.0/keylist_update',
  ForwardMessage = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/routing/1.0/forward',
}

export async function createInvitation({ label, serviceEndpoint, recipientKeys, routingKeys }: InvitationDetails) {
  const invitation = {
    '@type': MessageType.ConnectionInvitation,
    '@id': uuid(),
    label,
    recipientKeys,
    serviceEndpoint,
    routingKeys,
  };
  return invitation;
}

export function createBasicMessage(connection: Connection, content: string) {
  const basicMessage = {
    '@id': uuid(),
    '@type': MessageType.BasicMessage,
    '~l10n': { locale: 'en' },
    sent_time: new Date().toISOString(),
    content,
  };

  if (!connection.endpoint || !connection.theirKey) {
    throw new Error('Invalid connection endpoint');
  }

  const outboundMessage = {
    connection,
    endpoint: connection.endpoint,
    payload: basicMessage,
    recipientKeys: [connection.theirKey],
    routingKeys: connection.didDoc.service[0].routingKeys,
    senderVk: connection.verkey,
  };

  return outboundMessage;
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
