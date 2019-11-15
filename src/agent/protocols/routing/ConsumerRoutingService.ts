import logger from '../../logger';
import { createRouteUpdateMessage } from './messages';
import { createOutboundMessage } from '../helpers';
import { Context } from '../../Context';

class ConsumerRoutingService {
  context: Context;

  constructor(context: Context) {
    this.context = context;
  }

  async createRoute(verkey: Verkey) {
    logger.log('Creating route...');

    if (!this.context.inboundConnection) {
      logger.log('There is no agency. Creating route skipped.');
    } else {
      const routingConnection = this.context.inboundConnection.connection;
      const routeUpdateMessage = createRouteUpdateMessage(verkey);

      const outboundMessage = createOutboundMessage(routingConnection, routeUpdateMessage);
      await this.context.messageSender.sendMessage(outboundMessage);
    }
  }
}

export { ConsumerRoutingService };
