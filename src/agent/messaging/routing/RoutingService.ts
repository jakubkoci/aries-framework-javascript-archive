import { Connection } from '../../types';

class RoutingService {
  routingTable: { [recipientKey: string]: Connection } = {};

  getRoutes() {
    return this.routingTable;
  }

  findRecipient(recipientKey: Verkey) {
    const connection = this.routingTable[recipientKey];

    if (!connection) {
      throw new Error(`Routing entry for recipientKey ${recipientKey} does not exists.`);
    }

    return connection;
  }

  saveRoute(recipientKey: Verkey, connection: Connection) {
    if (this.routingTable[recipientKey]) {
      throw new Error(`Routing entry for recipientKey ${recipientKey} already exists.`);
    }

    this.routingTable[recipientKey] = connection;
  }
}

export { RoutingService };
