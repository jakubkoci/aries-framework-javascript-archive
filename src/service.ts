import indy from 'indy-sdk';
import { post } from './http';
import config from './config';
import { sign } from './decorators';
import { Connection, OutboundMessage, ConnectionState, InboundMessage } from './types';

let wh: number;
const connections: Connection[] = [];

export async function init() {
  const walletConfig = { id: config.walletId };
  const walletCredentials = { key: config.walletSeed };

  try {
    await indy.createWallet(walletConfig, walletCredentials);
  } catch (error) {
    if (error.indyName && error.indyName === 'WalletAlreadyExistsError') {
      console.log(error.indyName);
    } else {
      throw error;
    }
  }

  wh = await indy.openWallet(walletConfig, walletCredentials);
  console.log(`Wallet opened with handle: ${wh}`);
}

export async function processMessage(inboundPackedMessage: any) {
  let inboundMessage;

  if (!inboundPackedMessage['@type']) {
    inboundMessage = await unpack(inboundPackedMessage);
  } else {
    inboundMessage = { message: inboundPackedMessage };
  }

  console.log('inboundMessage', inboundMessage);
  const outboundMessage = await dispatch(inboundMessage);
  console.log('outboundMessage', outboundMessage);

  const outboundPackedMessage = await pack(outboundMessage);
  return outboundPackedMessage;

  // TODO
  // send message and update connection state
  // fetch(outboundMessage.endpoint, { method: 'POST', body: JSON.stringify(outboundPackedMessage) });
  // connection.state = ConnectionState.XXX;
}

export async function dispatch(inboundMessage: any): Promise<OutboundMessage> {
  const messageType = inboundMessage.message['@type'];
  switch (messageType) {
    case 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/invitation': {
      return handleInvitation(inboundMessage);
    }
    case 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/request': {
      return handleConnectionRequest(inboundMessage);
    }
    case 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/response': {
      return handleConnectionResponse(inboundMessage);
    }
    case 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/basicmessage/1.0/message': {
      return handleBasicMessage(inboundMessage);
    }
    default:
      throw new Error('No handler for message found');
  }
}

export async function createConnection(): Promise<Connection> {
  const [did, verkey] = await indy.createAndStoreMyDid(wh, {});
  return {
    did,
    verkey,
    state: ConnectionState.INIT,
    messages: [],
  };
}

export async function createInvitation() {
  const connection = await createConnection();
  const { verkey } = connection;
  const invitation = {
    '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/invitation',
    '@id': '12345678900987654321',
    label: config.label,
    recipientKeys: [verkey],
    serviceEndpoint: 'https://localhost:8080/msg',
    routingKeys: [],
  };

  connection.state = ConnectionState.INVITED;
  connection.invitation = invitation;
  connections.push(connection);
  return connection;
}

export async function handleInvitation(inboundMessage: InboundMessage) {
  const invitation = inboundMessage.message;
  const connection = await createConnection();
  const connectionRequest = {
    '@id': '5678876542345',
    '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/didexchange/1.0/request',
    label: config.label,
    connection: {
      did: connection.did,
      did_doc: {
        '@context': 'https://w3id.org/did/v1',
        service: [
          {
            id: 'did:example:123456789abcdefghi#did-communication',
            type: 'did-communication',
            priority: 0,
            recipientKeys: [connection.verkey],
            routingKeys: [],
            serviceEndpoint: `${config.url}:${config.port}/msg`,
          },
        ],
      },
    },
  };

  connections.push(connection);

  const outboundMessage = {
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
      did_doc: {
        '@context': 'https://w3id.org/did/v1',
        service: [
          {
            id: 'did:example:123456789abcdefghi#did-communication',
            type: 'did-communication',
            priority: 0,
            recipientKeys: [connection.verkey],
            routingKeys: [],
            serviceEndpoint: `${config.url}:${config.port}/msg`,
          },
        ],
      },
    },
  };

  const signedConnectionResponse = await sign(wh, connectionResponse, 'connection', connection.verkey);

  if (!connection.endpoint) {
    throw new Error('Invalid connection endpoint');
  }

  const outboundMessage = {
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

  const outboundMessage = {
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
    endpoint: connection.endpoint,
    payload: response,
    recipientKeys: [sender_verkey],
    routingKeys: [],
    senderVk: connection.verkey,
  };

  return outboundMessage;
}

export function getConnections() {
  return connections;
}

export function getMessages(verkey: Verkey) {
  const connection = findByVerkey(verkey);
  if (!connection) {
    throw new Error(`Connection for verkey ${verkey} not found!`);
  }
  return connection.messages;
}

export async function sendMessage(verkey: Verkey, message: string) {
  const connection = findByVerkey(verkey);
  if (!connection) {
    throw new Error(`Connection for verkey ${verkey} not found!`);
  }
  const outboundMessage = await sendMessageToConnection(connection, message);
  console.log('outboundMessage', outboundMessage);

  const outboundPackedMessage = await pack(outboundMessage);

  await post(outboundMessage.endpoint, JSON.stringify(outboundPackedMessage));
}

function findByVerkey(verkey: Verkey) {
  return connections.find(connection => connection.verkey === verkey);
}

async function sendMessageToConnection(connection: Connection, message: string): Promise<OutboundMessage> {
  const basicMessage = {
    '@id': '123456780',
    '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/basicmessage/1.0/message',
    '~l10n': { locale: 'en' },
    sent_time: new Date().toISOString(),
    content: message,
  };

  if (!connection.endpoint || !connection.theirKey) {
    throw new Error('Invalid connection endpoint');
  }

  const outboundMessage = {
    endpoint: connection.endpoint,
    payload: basicMessage,
    recipientKeys: [connection.theirKey],
    routingKeys: [],
    senderVk: connection.verkey,
  };

  return outboundMessage;
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
