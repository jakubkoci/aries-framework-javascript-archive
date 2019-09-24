import uuid from 'uuid/v4';
import { InboundMessage, OutboundMessage, Connection, ConnectionState, Agency } from './types';
import { ConnectionService } from './ConnectionService';
import { Wallet } from './Wallet';
import { MessageType } from './messages';
import { RoutingService } from './RoutingService';

export type Handler = (inboudMessage: InboundMessage, context: Context) => Promise<OutboundMessage | null>;

const {
  ConnectionInvitation,
  ConnectionRequest,
  ConnectionResposne,
  Ack,
  BasicMessage,
  RouteUpdateMessage,
  ForwardMessage,
} = MessageType;

export const handlers = {
  [ConnectionInvitation]: handleInvitation,
  [ConnectionRequest]: handleConnectionRequest,
  [ConnectionResposne]: handleConnectionResponse,
  [Ack]: handleAckMessage,
  [BasicMessage]: handleBasicMessage,
  [RouteUpdateMessage]: handleRouteUpdateMessage,
  [ForwardMessage]: handleForwardMessage,
};

interface Context {
  config: any;
  wallet: Wallet;
  agency?: Agency;
  connectionService: ConnectionService;
  routingService: RoutingService; // TODO this is currently used only in agency agent
}

export async function handleInvitation(inboundMessage: InboundMessage, context: Context) {
  const { config, connectionService, agency } = context;
  const invitation = inboundMessage.message;
  const connection = await connectionService.createConnection(agency);
  return createConnectionRequestMessage(connection, invitation, config.label);
}

function createConnectionRequestMessage(connection: Connection, invitation: any, label: string) {
  const connectionRequest = {
    '@type': ConnectionRequest,
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

export async function handleConnectionRequest(inboundMessage: InboundMessage, context: Context) {
  const { wallet, connectionService } = context;
  const { message, recipient_verkey, sender_verkey } = inboundMessage;
  const connection = connectionService.findByVerkey(recipient_verkey);

  if (!connection) {
    throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
  }

  if (!message.connection) {
    throw new Error('Invalid message');
  }

  const connectionRequest = message;

  connection.theirDid = connectionRequest.connection.did;
  connection.theirKey = connectionRequest.connection.did_doc.service[0].recipientKeys[0];
  connection.endpoint = connectionRequest.connection.did_doc.service[0].serviceEndpoint;

  if (!connection.theirKey) {
    throw new Error('Missing verkey in connection request!');
  }

  const connectionResponse = {
    '@type': ConnectionResposne,
    '@id': uuid(),
    '~thread': {
      thid: message['@id'],
    },
    connection: {
      did: connection.did,
      did_doc: connection.didDoc,
    },
  };

  const signedConnectionResponse = await wallet.sign(connectionResponse, 'connection', connection.verkey);

  if (!connection.endpoint) {
    throw new Error('Invalid connection endpoint');
  }

  connection.state = ConnectionState.RESPONDED;

  const outboundMessage = {
    connection,
    endpoint: connection.endpoint,
    payload: signedConnectionResponse,
    recipientKeys: [connection.theirKey],
    routingKeys: connection.didDoc.service[0].routingKeys,
    senderVk: connection.verkey,
  };

  return outboundMessage;
}

export async function handleConnectionResponse(inboundMessage: InboundMessage, context: Context) {
  const { wallet, connectionService } = context;
  const { message, recipient_verkey, sender_verkey } = inboundMessage;

  if (!message['connection~sig']) {
    throw new Error('Invalid message');
  }

  const connectionSignature = message['connection~sig'];
  const signerVerkey = connectionSignature.signers;
  const data = Buffer.from(connectionSignature.sig_data, 'base64');
  const signature = Buffer.from(connectionSignature.signature, 'base64');

  // check signature
  const valid = await wallet.verify(signerVerkey, data, signature);

  const connectionReponse = JSON.parse(data.toString('utf-8'));

  if (!valid) {
    throw new Error('Signature is not valid!');
  }

  const connection = connectionService.findByVerkey(recipient_verkey);

  if (!connection) {
    throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
  }

  connection.theirDid = connectionReponse.did;
  connection.theirKey = connectionReponse.did_doc.service[0].recipientKeys[0];
  connection.endpoint = connectionReponse.did_doc.service[0].serviceEndpoint;

  const response = {
    '@type': Ack,
    '@id': uuid(),
    status: 'OK',
    '~thread': {
      thid: message['@id'],
    },
  };

  if (!connection.endpoint) {
    throw new Error('Invalid connection endpoint');
  }

  connection.state = ConnectionState.COMPLETE;

  const outboundMessage = {
    connection,
    endpoint: connection.endpoint,
    payload: response,
    recipientKeys: [sender_verkey],
    routingKeys: connection.didDoc.service[0].routingKeys,
    senderVk: connection.verkey,
  };
  return outboundMessage;
}

export async function handleBasicMessage(inboundMessage: InboundMessage, context: Context) {
  const { connectionService } = context;
  const { message, recipient_verkey, sender_verkey } = inboundMessage;
  const connection = connectionService.findByVerkey(recipient_verkey);

  if (!connection) {
    throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
  }

  connection.messages.push(message);

  const response = {
    '@type': Ack,
    '@id': uuid(),
    status: 'OK',
    '~thread': {
      thid: message['@id'],
    },
  };

  if (!connection.endpoint) {
    throw new Error('Invalid connection endpoint');
  }

  const outboundMessage = {
    connection,
    endpoint: connection.endpoint,
    payload: response,
    recipientKeys: [sender_verkey],
    routingKeys: connection.didDoc.service[0].routingKeys,
    senderVk: connection.verkey,
  };

  return outboundMessage;
}

export async function handleAckMessage(inboundMessage: InboundMessage, context: Context) {
  const { connectionService } = context;
  const { message, recipient_verkey, sender_verkey } = inboundMessage;
  const connection = connectionService.findByVerkey(recipient_verkey);

  if (!connection) {
    throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
  }

  if (connection.state !== ConnectionState.COMPLETE) {
    connection.state = ConnectionState.COMPLETE;
  }

  return null;
}

type RouteUpdate = {
  action: 'add' | 'remove';
  recipient_key: Verkey;
};

export async function handleRouteUpdateMessage(inboundMessage: InboundMessage, context: Context) {
  const { connectionService, routingService } = context;
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
}

export async function handleForwardMessage(
  inboundMessage: InboundMessage,
  context: Context
): Promise<OutboundMessage | null> {
  const { routingService } = context;
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
}
