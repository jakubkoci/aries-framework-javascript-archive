import uuid from 'uuid/v4';
import { InboundMessage, OutboundMessage, Connection, ConnectionState, Agency } from '../../types';

export enum MessageType {
  BasicMessage = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/basicmessage/1.0/message',
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
