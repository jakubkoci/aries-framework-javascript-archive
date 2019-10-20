import { Connection, ConnectionState, InitConfig, Agency } from '../../types';
import { Wallet } from '../../Wallet';
import { createInvitationMessage } from './messages';

class ConnectionService {
  config: InitConfig;
  wallet: Wallet;
  connections: Connection[] = [];

  constructor(config: InitConfig, wallet: Wallet) {
    this.config = config;
    this.wallet = wallet;
  }

  async createConnectionWithInvitation(agency?: Agency): Promise<Connection> {
    const connection = await this.createConnection(agency);
    const invitationDetails = this.createInvitationDetails(this.config, connection);
    const invitation = await createInvitationMessage(invitationDetails);
    connection.state = ConnectionState.INVITED;
    connection.invitation = invitation;
    return connection;
  }

  async createConnection(agency?: Agency): Promise<Connection> {
    const [did, verkey] = await this.wallet.createDid();
    const did_doc = {
      '@context': 'https://w3id.org/did/v1',
      service: [
        {
          id: 'did:example:123456789abcdefghi#did-communication',
          type: 'did-communication',
          priority: 0,
          recipientKeys: [verkey],
          routingKeys: this.getRoutingKeys(agency),
          serviceEndpoint: this.getEndpoint(agency),
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

    this.connections.push(connection);

    return connection;
  }

  getConnections() {
    return this.connections;
  }

  findByVerkey(verkey: Verkey) {
    return this.connections.find(connection => connection.verkey === verkey);
  }

  findByTheirKey(verkey: Verkey) {
    return this.connections.find(connection => connection.theirKey === verkey);
  }

  private createInvitationDetails(config: InitConfig, connection: Connection) {
    const { didDoc } = connection;
    return {
      label: config.label,
      recipientKeys: didDoc.service[0].recipientKeys,
      serviceEndpoint: didDoc.service[0].serviceEndpoint,
      routingKeys: didDoc.service[0].routingKeys,
    };
  }

  private getEndpoint(agency?: Agency) {
    const connection = agency && agency.connection;
    const endpoint = connection && connection.theirDidDoc && connection.theirDidDoc.service[0].serviceEndpoint;
    return endpoint ? `${endpoint}` : `${this.config.url}:${this.config.port}/msg`;
  }

  private getRoutingKeys(agency?: Agency) {
    const verkey = agency && agency.verkey;
    return verkey ? [verkey] : [];
  }
}

export { ConnectionService };
