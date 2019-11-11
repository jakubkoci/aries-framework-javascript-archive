import { Dispatcher, Handler, OutboundMessage } from './types';
import { MessageSender } from './MessageSender';

class BasicDispatcher implements Dispatcher {
  handlers: { [key: string]: Handler } = {};
  messageSender: MessageSender;

  constructor(handlers: { [key: string]: Handler } = {}, messageSender: MessageSender) {
    this.handlers = handlers;
    this.messageSender = messageSender;
  }

  async dispatch(inboundMessage: any): Promise<OutboundMessage | null> {
    const messageType: string = inboundMessage.message['@type'];
    const handler = this.handlers[messageType];

    if (!handler) {
      throw new Error(`No handler for message type "${messageType}" found`);
    }

    const outboundMessage = await handler(inboundMessage);
    if (outboundMessage) {
      this.messageSender.sendMessage(outboundMessage);
    }
    return outboundMessage;
  }
}

export { BasicDispatcher };
