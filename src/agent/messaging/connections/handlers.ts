import { InboundMessage, ConnectionState } from '../../types';
import { ConnectionService } from './ConnectionService';
import { createConnectionRequestMessage, createAckMessage, createConnectionResponseMessage } from './messages';
import { Context } from '../interface';

export function handleInvitation(connectionService: ConnectionService) {
  return async (inboundMessage: InboundMessage, context: Context) => {
    const { config, agency } = context;
    const invitation = inboundMessage.message;
    const connection = await connectionService.createConnection(agency);
    const connectionRequest = createConnectionRequestMessage(connection, config.label);

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
  };
}

export function handleConnectionRequest(connectionService: ConnectionService) {
  return async (inboundMessage: InboundMessage, context: Context) => {
    const { wallet } = context;
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
    connection.theirRoutingKeys = connectionRequest.connection.did_doc.service[0].routingKeys;

    if (!connection.theirKey) {
      throw new Error('Missing verkey in connection request!');
    }

    const connectionResponse = createConnectionResponseMessage(connection, message['@id']);

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
      routingKeys: connection.theirRoutingKeys || [],
      senderVk: connection.verkey,
    };

    return outboundMessage;
  };
}

export function handleConnectionResponse(connectionService: ConnectionService) {
  return async (inboundMessage: InboundMessage, context: Context) => {
    const { wallet } = context;
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
    connection.theirRoutingKeys = connectionReponse.did_doc.service[0].routingKeys;

    const response = createAckMessage(message['@id']);

    if (!connection.endpoint) {
      throw new Error('Invalid connection endpoint');
    }

    connection.state = ConnectionState.COMPLETE;

    const outboundMessage = {
      connection,
      endpoint: connection.endpoint,
      payload: response,
      recipientKeys: [sender_verkey],
      routingKeys: connection.theirRoutingKeys || [],
      senderVk: connection.verkey,
    };
    return outboundMessage;
  };
}

export function handleAckMessage(connectionService: ConnectionService) {
  return async (inboundMessage: InboundMessage, context: Context) => {
    const { message, recipient_verkey, sender_verkey } = inboundMessage;
    const connection = connectionService.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    if (connection.state !== ConnectionState.COMPLETE) {
      connection.state = ConnectionState.COMPLETE;
    }

    return null;
  };
}
