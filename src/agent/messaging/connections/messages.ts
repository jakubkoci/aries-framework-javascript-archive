import uuid from 'uuid/v4';
import { InvitationDetails, Connection, ConnectionState } from '../../types';

export enum MessageType {
  ConnectionInvitation = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/invitation',
  ConnectionRequest = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/request',
  ConnectionResposne = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/response',
  Ack = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/notification/1.0/ack',
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

export function createConnectionRequestMessage(connection: Connection, invitation: any, label: string) {
  const connectionRequest = {
    '@type': MessageType.ConnectionRequest,
    '@id': uuid(),
    label: label,
    connection: {
      did: connection.did,
      did_doc: connection.didDoc,
    },
  };

  connection.state = ConnectionState.REQUESTED;

  const outboundMessage = {
    connection,
    endpoint: invitation.serviceEndpoint,
    payload: connectionRequest,
    recipientKeys: invitation.recipientKeys,
    routingKeys: invitation.routingKeys,
    senderVk: null,
  };

  return outboundMessage;
}
