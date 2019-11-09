import { InboundMessage, ConnectionState } from '../../types';
import { ConnectionService } from './ConnectionService';
import { createAckMessage, createConnectionResponseMessage } from './messages';
import { createOutboundMessage } from '../helpers';

export function handleInvitation(connectionService: ConnectionService) {
  return async (inboundMessage: InboundMessage) => {
    const invitation = inboundMessage.message    
    const outboudMessage = connectionService.acceptInvitation(invitation)
    return outboudMessage
  };
}

export function handleConnectionRequest(connectionService: ConnectionService) {
  return async (inboundMessage: InboundMessage) => {
    // TODO Temporarily get context from service until this code will be move into connection service itself
    const { wallet } = connectionService.getContext();
    const { message, recipient_verkey, sender_verkey } = inboundMessage;
    const connection = connectionService.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    // TODO I have 2 questions
    // 1. I don't know whether following check is necessary.
    // 2. I don't know whether to use `connection.theirKey` or `sender_verkey` for outbound message.
    //
    // This problem in other handlers is handled just by checking existance of attribute `connection.theirKey`
    // and omitting `sender_key` from any usage.
    if (sender_verkey !== connection.theirKey) {
      throw new Error('Inbound message `sender_key` attribute is different from connection.theirKey');
    }

    if (!message.connection) {
      throw new Error('Invalid message');
    }

    const connectionRequest = message;

    connection.theirDid = connectionRequest.connection.did;
    connection.theirDidDoc = connectionRequest.connection.did_doc;
    // Keep also theirKey for debug reasons
    connection.theirKey = connection.theirDidDoc.service[0].recipientKeys[0];

    if (!connection.theirKey) {
      throw new Error('Missing verkey in connection request!');
    }

    const connectionResponse = createConnectionResponseMessage(connection, message['@id']);

    const signedConnectionResponse = await wallet.sign(connectionResponse, 'connection', connection.verkey);

    connection.state = ConnectionState.RESPONDED;

    return createOutboundMessage(connection, signedConnectionResponse);
  };
}

export function handleConnectionResponse(connectionService: ConnectionService) {
  return async (inboundMessage: InboundMessage) => {
    // TODO Temporarily get context from service until this code will be move into connection service itself
    const { wallet } = connectionService.getContext();
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

    if (!valid) {
      throw new Error('Signature is not valid!');
    }

    const connection = connectionService.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    const connectionReponse = JSON.parse(data.toString('utf-8'));
    connection.theirDid = connectionReponse.did;
    connection.theirDidDoc = connectionReponse.did_doc;
    // Keep also theirKey for debug reasons
    connection.theirKey = connection.theirDidDoc.service[0].recipientKeys[0];

    if (!connection.theirKey) {
      throw new Error(`Connection with verkey ${connection.verkey} has no recipient keys.`);
    }

    const response = createAckMessage(message['@id']);

    connection.state = ConnectionState.COMPLETE;

    return createOutboundMessage(connection, response);
  };
}

export function handleAckMessage(connectionService: ConnectionService) {
  return async (inboundMessage: InboundMessage) => {
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
