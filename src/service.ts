import indy from 'indy-sdk';
import logger from './logger';
import { post, get } from './http';
import config from './config';
import { sign } from './decorators';
import { Connection, OutboundMessage, ConnectionState, InboundMessage, ConnectionInvitation } from './types';

let wh: number;
let configAsAgency: {
  did?: Did;
  verkey?: Verkey;
} = {};
const connections: Connection[] = [];
let inboundConnection: Connection;

export async function init() {
  const walletConfig = { id: config.walletId };
  const walletCredentials = { key: config.walletSeed };

  try {
    await indy.createWallet(walletConfig, walletCredentials);
  } catch (error) {
    if (error.indyName && error.indyName === 'WalletAlreadyExistsError') {
      logger.log(error.indyName);
    } else {
      throw error;
    }
  }

  wh = await indy.openWallet(walletConfig, walletCredentials);
  logger.log(`Wallet opened with handle: ${wh}`);

  if (isAgency()) {
    console.log('Agency init...');
    try {
      const [did, verkey] = await indy.createAndStoreMyDid(wh, { seed: '0000000000000000000000000Forward' });
      configAsAgency.did = did;
      configAsAgency.verkey = verkey;
    } catch (error) {
      if (error.indyName && error.indyName === 'DidAlreadyExistsError') {
        logger.log(error.indyName);
      } else {
        throw error;
      }
    }
  }
}

export function isAgency() {
  return !config.agencyUrl;
}

export async function registerAgency(invitation: ConnectionInvitation) {
  inboundConnection = await createConnection();
  const connectionRequestMessage = createConnectionRequestMessage(inboundConnection, invitation);
  await sendMessage(connectionRequestMessage);
}

export function getConfigAsAgency() {
  return configAsAgency;
}

export async function receiveMessage(inboundPackedMessage: any) {
  let inboundMessage;

  if (!inboundPackedMessage['@type']) {
    inboundMessage = await unpack(inboundPackedMessage);
  } else {
    inboundMessage = { message: inboundPackedMessage };
  }

  logger.logJson('inboundMessage', inboundMessage);
  const outboundMessage = await dispatch(inboundMessage);
  logger.logJson('outboundMessage', outboundMessage);

  if (outboundMessage) {
    sendMessage(outboundMessage);
  }
}

interface Handlers {
  [key: string]: (inboudMessage: InboundMessage) => Promise<OutboundMessage | null>;
}

export async function dispatch(inboundMessage: any): Promise<OutboundMessage | null> {
  const messageType: string = inboundMessage.message['@type'];
  const handlers: Handlers = {
    'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/invitation': handleInvitation,
    'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/request': handleConnectionRequest,
    'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/response': handleConnectionResponse,
    'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/notification/1.0/ack': handleAckMessage,
    'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/basicmessage/1.0/message': handleBasicMessage,
  };

  const handler = handlers[messageType];

  if (!handler) {
    throw new Error('No handler for message found');
  }

  return handler(inboundMessage);
}

export async function createConnectionWithInvitation() {
  const connection = await createConnection();
  const { verkey } = connection;
  const invitation = {
    '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/invitation',
    '@id': '12345678900987654321',
    label: config.label,
    recipientKeys: [verkey],
    serviceEndpoint: `${config.url}:${config.port}/msg`,
    routingKeys: [],
  };

  connection.state = ConnectionState.INVITED;
  connection.invitation = invitation;
  return connection;
}

export async function handleInvitation(inboundMessage: InboundMessage) {
  const invitation = inboundMessage.message;
  const connection = await createConnection();
  return createConnectionRequestMessage(connection, invitation);
}

export async function getAgencyMessages(): Promise<any[]> {
  const messages = await get(`${config.agencyUrl}/api/connections/${inboundConnection.verkey}/messages`);
  return JSON.parse(messages);
}

function createConnectionRequestMessage(connection: Connection, invitation: any) {
  const connectionRequest = {
    '@id': '5678876542345',
    '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/request',
    label: config.label,
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
    routingKeys: [],
    senderVk: null,
  };

  return outboundMessage;
}

export async function handleConnectionRequest(unpackedMessage: InboundMessage) {
  const { message, recipient_verkey, sender_verkey } = unpackedMessage;
  const connection = findByVerkey(recipient_verkey);

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
    '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/response',
    '@id': '12345678900987654321',
    '~thread': {
      thid: message['@id'],
    },
    connection: {
      did: connection.did,
      did_doc: connection.didDoc,
    },
  };

  const signedConnectionResponse = await sign(wh, connectionResponse, 'connection', connection.verkey);

  if (!connection.endpoint) {
    throw new Error('Invalid connection endpoint');
  }

  connection.state = ConnectionState.RESPONDED;

  const outboundMessage = {
    connection,
    endpoint: connection.endpoint,
    payload: signedConnectionResponse,
    recipientKeys: [connection.theirKey],
    routingKeys: [],
    senderVk: connection.verkey,
  };

  return outboundMessage;
}

export async function handleConnectionResponse(unpackedMessage: InboundMessage) {
  const { message, recipient_verkey, sender_verkey } = unpackedMessage;

  if (!message['connection~sig']) {
    throw new Error('Invalid message');
  }

  const connectionSignature = message['connection~sig'];
  const signerVerkey = connectionSignature.signers;
  const data = Buffer.from(connectionSignature.sig_data, 'base64');
  const signature = Buffer.from(connectionSignature.signature, 'base64');

  // check signature
  const valid = await indy.cryptoVerify(signerVerkey, data, signature);

  const connectionReponse = JSON.parse(data.toString('utf-8'));

  if (!valid) {
    throw new Error('Signature is not valid!');
  }

  const connection = findByVerkey(recipient_verkey);

  if (!connection) {
    throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
  }

  connection.theirDid = connectionReponse.did;
  connection.theirKey = connectionReponse.did_doc.service[0].recipientKeys[0];
  connection.endpoint = connectionReponse.did_doc.service[0].serviceEndpoint;

  const response = {
    '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/notification/1.0/ack',
    '@id': '12345678900987654321',
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
    routingKeys: [],
    senderVk: connection.verkey,
  };
  return outboundMessage;
}

async function handleBasicMessage(inboundMessage: InboundMessage) {
  const { message, recipient_verkey, sender_verkey } = inboundMessage;
  const connection = findByVerkey(recipient_verkey);

  if (!connection) {
    throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
  }

  connection.messages.push(message);

  const response = {
    '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/notification/1.0/ack',
    '@id': '12345678900987654321',
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
    routingKeys: [],
    senderVk: connection.verkey,
  };

  return outboundMessage;
}

async function handleAckMessage(inboundMessage: InboundMessage) {
  const { message, recipient_verkey, sender_verkey } = inboundMessage;
  const connection = findByVerkey(recipient_verkey);

  if (!connection) {
    throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
  }

  if (connection.state !== ConnectionState.COMPLETE) {
    connection.state = ConnectionState.COMPLETE;
  }

  return null;
}

export function getConnections() {
  return connections;
}

export function getMessages(verkey: Verkey) {
  const connection = findByVerkey(verkey);
  if (!connection) {
    throw new Error(`Connection for verkey ${verkey} not found!`);
  }
  const messages = [...connection.messages];
  return messages;
}

export function getMessagesByTheirKey(theirKey: Verkey) {
  console.log(`Getting messages ${theirKey}`);
  const connection = findByTheirKey(theirKey);
  if (!connection) {
    console.log(`Connection for theirKey ${theirKey} not found!`);
    return [];
  }
  const messages = [...connection.messages];
  connection.messages = [];
  return messages;
}

export async function sendMessage(outboundMessage: OutboundMessage) {
  logger.logJson('outboundMessage', outboundMessage);
  const outboundPackedMessage = await pack(outboundMessage);
  if (isAgency()) {
    outboundMessage.connection.messages.push(outboundPackedMessage);
  } else {
    await post(outboundMessage.endpoint, JSON.stringify(outboundPackedMessage));
  }
}

export function findByVerkey(verkey: Verkey) {
  return connections.find(connection => connection.verkey === verkey);
}

export function findByTheirKey(theirKey: Verkey) {
  return connections.find(connection => connection.theirKey === theirKey);
}

export function createBasicMessage(connection: Connection, content: string) {
  const basicMessage = {
    '@id': '123456780',
    '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/basicmessage/1.0/message',
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
    routingKeys: [],
    senderVk: connection.verkey,
  };

  return outboundMessage;
}

async function createConnection(): Promise<Connection> {
  const [did, verkey] = await indy.createAndStoreMyDid(wh, {});
  const did_doc = {
    '@context': 'https://w3id.org/did/v1',
    service: [
      {
        id: 'did:example:123456789abcdefghi#did-communication',
        type: 'did-communication',
        priority: 0,
        recipientKeys: [verkey],
        routingKeys: [],
        serviceEndpoint: `${config.url}:${config.port}/msg`,
      },
    ],
  };

  const connection = {
    did,
    didDoc: did_doc,
    verkey,
    state: ConnectionState.INIT,
    messages: [],
  };

  connections.push(connection);

  return connection;
}

async function pack(outboundMessage: OutboundMessage): Promise<JsonWebKey> {
  const { payload, recipientKeys, senderVk } = outboundMessage;
  const messageRaw = Buffer.from(JSON.stringify(payload), 'utf-8');
  const packedMessage = await indy.packMessage(wh, messageRaw, recipientKeys, senderVk);
  return JSON.parse(packedMessage.toString('utf-8'));
}

async function unpack(messagePackage: JsonWebKey): Promise<InboundMessage> {
  const unpackedMessageBuffer = await indy.unpackMessage(wh, Buffer.from(JSON.stringify(messagePackage), 'utf-8'));
  const unpackedMessage = JSON.parse(unpackedMessageBuffer.toString('utf-8'));
  return {
    ...unpackedMessage,
    message: JSON.parse(unpackedMessage.message),
  };
}
