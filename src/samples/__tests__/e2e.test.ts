/* eslint-disable no-console */
// @ts-ignore
import { poll } from 'await-poll';
import { Agent, decodeInvitationFromUrl, OutboundTransporter } from '../../lib';
import { Connection, WireMessage, OutboundPackage } from '../../lib/types';
import { get, post } from '../http';
import { toBeConnectedWith } from '../../lib/testUtils';

jest.setTimeout(10000);

expect.extend({ toBeConnectedWith });

const aliceConfig = {
  label: 'e2e Alice',
  walletName: 'e2e-alice',
  walletKey: '00000000000000000000000000000Test01',
};

const bobConfig = {
  label: 'e2e Bob',
  walletName: 'e2e-bob',
  walletKey: '00000000000000000000000000000Test02',
};

describe('with agency', () => {
  let aliceAgent: Agent;
  let bobAgent: Agent;

  test('make a connection with agency', async () => {
    const aliceAgencyUrl = `http://localhost:3001`;
    const bobAgencyUrl = `http://localhost:3002`;
    const aliceAgentSender = new HttpOutboundTransporter();
    const bobAgentSender = new HttpOutboundTransporter();

    aliceAgent = new Agent(aliceConfig, aliceAgentSender);
    await aliceAgent.init();

    bobAgent = new Agent(bobConfig, bobAgentSender);
    await bobAgent.init();

    const aliceAgencyInvitationUrl = await get(`${aliceAgencyUrl}/invitation`);
    const aliceKeyAtAliceAgency = await aliceAgent.acceptInvitationUrl(aliceAgencyInvitationUrl);

    const bobAgencyInvitationUrl = await get(`${bobAgencyUrl}/invitation`);
    const bobKeyAtBobAgency = await bobAgent.acceptInvitationUrl(bobAgencyInvitationUrl);

    pollMessages(aliceAgent, aliceAgencyUrl, aliceKeyAtAliceAgency);
    pollMessages(bobAgent, bobAgencyUrl, bobKeyAtBobAgency);

    const aliceConnectionAtAliceAgency = await poll(
      () => aliceAgent.findConnectionByMyKey(aliceKeyAtAliceAgency),
      (connection: Connection) => connection.state !== 4,
      200
    );
    console.log('aliceConnectionAtAliceAgency\n', aliceConnectionAtAliceAgency);

    const bobConnectionAtBobAgency = await poll(
      () => bobAgent.findConnectionByMyKey(bobKeyAtBobAgency),
      (connection: Connection) => connection.state !== 4,
      200
    );
    console.log('bobConnectionAtBobAgency\n', bobConnectionAtBobAgency);

    // TODO This endpoint currently exists at agency only for the testing purpose. It returns agency's part of the pairwise connection.
    const agencyConnectionAtAliceAgency = JSON.parse(
      await get(`${aliceAgencyUrl}/api/connections/${aliceKeyAtAliceAgency}`)
    );
    const agencyConnectionAtBobAgency = JSON.parse(await get(`${bobAgencyUrl}/api/connections/${bobKeyAtBobAgency}`));

    const { verkey: aliceAgencyVerkey } = JSON.parse(await get(`${aliceAgencyUrl}/`));
    const { verkey: bobAgencyVerkey } = JSON.parse(await get(`${bobAgencyUrl}/`));
    aliceAgent.establishInbound(aliceAgencyVerkey, aliceConnectionAtAliceAgency);
    bobAgent.establishInbound(bobAgencyVerkey, bobConnectionAtBobAgency);

    expect(aliceConnectionAtAliceAgency).toBeConnectedWith(agencyConnectionAtAliceAgency);
    expect(bobConnectionAtBobAgency).toBeConnectedWith(agencyConnectionAtBobAgency);
  });

  test('make a connection via agency', async () => {
    const invitationUrl = await aliceAgent.createInvitationUrl();
    await bobAgent.acceptInvitationUrl(invitationUrl);

    // We need to decode invitation URL to get keys from invitation
    // It can be maybe better to get connection ID instead of invitationUrl from the previous step and work with that
    const invitation = decodeInvitationFromUrl(invitationUrl);
    const aliceKeyAtAliceBob = invitation.recipientKeys[0];

    const aliceConnectionAtAliceBob = await poll(
      () => aliceAgent.findConnectionByMyKey(aliceKeyAtAliceBob),
      (connection: Connection) => connection.state !== 4,
      200
    );
    console.log('aliceConnectionAtAliceBob\n', aliceConnectionAtAliceBob);

    const bobKeyAtBobAlice = aliceConnectionAtAliceBob.theirKey;
    const bobConnectionAtBobAlice = await poll(
      () => bobAgent.findConnectionByMyKey(bobKeyAtBobAlice),
      (connection: Connection) => connection.state !== 4,
      200
    );
    console.log('bobConnectionAtAliceBob\n', bobConnectionAtBobAlice);

    expect(aliceConnectionAtAliceBob).toBeConnectedWith(bobConnectionAtBobAlice);
    expect(bobConnectionAtBobAlice).toBeConnectedWith(aliceConnectionAtAliceBob);
  });

  test('send a message to connection via agency', async () => {
    const aliceConnections = await aliceAgent.getConnections();
    console.log('aliceConnections', JSON.stringify(aliceConnections, null, 2));

    const bobConnections = await bobAgent.getConnections();
    console.log('bobConnections', JSON.stringify(bobConnections, null, 2));

    // send message from Alice to Bob
    const message = 'hello, world';
    await aliceAgent.sendMessageToConnection(aliceConnections[1], message);

    const bobMessages = await poll(
      () => {
        console.log(`Getting Bob's connection messages...`);
        const connections = bobAgent.getConnections();
        return connections[1].messages;
      },
      (messages: WireMessage[]) => messages.length < 1
    );
    console.log(bobMessages);
    expect(bobMessages[0].content).toBe(message);
  });
});

function pollMessages(agent: Agent, agencyUrl: string, verkey: Verkey) {
  poll(
    async () => {
      const message = await get(`${agencyUrl}/api/connections/${verkey}/message`);
      if (message && message.length > 0) {
        agent.receiveMessage(JSON.parse(message));
      }
    },
    () => true,
    500
  );
}

class HttpOutboundTransporter implements OutboundTransporter {
  async sendMessage(outboundPackage: OutboundPackage) {
    const { payload, endpoint } = outboundPackage;

    if (!endpoint) {
      throw new Error(`Missing endpoint. I don't know how and where to send the message.`);
    }

    console.log('Sending message...');
    console.log(payload);
    await post(`${endpoint}`, JSON.stringify(payload));
  }
}