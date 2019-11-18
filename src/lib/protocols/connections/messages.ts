import uuid from 'uuid/v4';
import { InvitationDetails, Connection } from '../../types';

export enum MessageType {
  ConnectionInvitation = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/invitation',
  ConnectionRequest = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/request',
  ConnectionResposne = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/response',
  Ack = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/notification/1.0/ack',
}

export async function createInvitationMessage({
  label,
  serviceEndpoint,
  recipientKeys,
  routingKeys,
}: InvitationDetails) {
  return {
    '@type': MessageType.ConnectionInvitation,
    '@id': uuid(),
    label,
    recipientKeys,
    serviceEndpoint,
    routingKeys,
  };
}

export function createConnectionRequestMessage(connection: Connection, label: string) {
  return {
    '@type': MessageType.ConnectionRequest,
    '@id': uuid(),
    label: label,
    connection: {
      did: connection.did,
      did_doc: connection.didDoc,
    },
  };
}

export function createConnectionResponseMessage(connection: Connection, thid: string) {
  return {
    '@type': MessageType.ConnectionResposne,
    '@id': uuid(),
    '~thread': {
      thid,
    },
    connection: {
      did: connection.did,
      did_doc: connection.didDoc,
    },
  };
}

export function createAckMessage(thid: string) {
  return {
    '@type': MessageType.Ack,
    '@id': uuid(),
    status: 'OK',
    '~thread': {
      thid: thid,
    },
  };
}
