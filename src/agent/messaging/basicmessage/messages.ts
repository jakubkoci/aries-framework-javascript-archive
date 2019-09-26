import uuid from 'uuid/v4';
import { InboundMessage, OutboundMessage, Connection, ConnectionState, Agency } from '../../types';

export enum MessageType {
  BasicMessage = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/basicmessage/1.0/message',
}

export function createBasicMessage(content: string) {
  return {
    '@id': uuid(),
    '@type': MessageType.BasicMessage,
    '~l10n': { locale: 'en' },
    sent_time: new Date().toISOString(),
    content,
  };
}
