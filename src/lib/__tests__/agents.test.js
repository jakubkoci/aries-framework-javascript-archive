/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */
const { Subject } = require('rxjs');
const { poll } = require('await-poll');
const { Agent, decodeInvitationFromUrl } = require('../');
const { toBeConnectedWith } = require('./utils');

jest.setTimeout(10000);

expect.extend({ toBeConnectedWith });

const aliceConfig = {
  label: 'Alice',
  walletName: 'alice',
  walletKey: '00000000000000000000000000000Test01',
};

const bobConfig = {
  label: 'Bob',
  walletName: 'bob',
  walletKey: '00000000000000000000000000000Test02',
};

describe('agents', () => {
  let aliceAgent;
  let bobAgent;

  test('make a connection between agents', async () => {
    const aliceMessages = new Subject();
    const bobMessages = new Subject();

    const aliceAgentSender = new SubjectOutboundTransporter(bobMessages);
    const bobAgentSender = new SubjectOutboundTransporter(aliceMessages);

    aliceAgent = new Agent(aliceConfig, aliceAgentSender);
    await aliceAgent.init();

    bobAgent = new Agent(bobConfig, bobAgentSender);
    await bobAgent.init();

    subscribe(aliceAgent, aliceMessages);
    subscribe(bobAgent, bobMessages);

    const invitationUrl = await aliceAgent.createInvitationUrl();
    await bobAgent.acceptInvitationUrl(invitationUrl);

    // We need to decode invitation URL to get keys from invitation
    // It can be maybe better to get connection ID instead of invitationUrl from the previous step and work with that
    const invitation = decodeInvitationFromUrl(invitationUrl);
    const aliceKeyAtAliceBob = invitation.recipientKeys[0];

    const aliceConnectionAtAliceBob = await poll(
      () => aliceAgent.findConnectionByMyKey(aliceKeyAtAliceBob),
      connection => connection.state !== 4,
      100
    );
    console.log('aliceConnectionAtAliceBob\n', aliceConnectionAtAliceBob);

    const bobKeyAtBobAlice = aliceConnectionAtAliceBob.theirKey;
    const bobConnectionAtBobAlice = await poll(
      () => bobAgent.findConnectionByMyKey(bobKeyAtBobAlice),
      connection => connection.state !== 4,
      100
    );
    console.log('bobConnectionAtAliceBob\n', bobConnectionAtBobAlice);

    expect(aliceConnectionAtAliceBob).toBeConnectedWith(bobConnectionAtBobAlice);
    expect(bobConnectionAtBobAlice).toBeConnectedWith(aliceConnectionAtAliceBob);
  });

  test('send a message to connection', async () => {
    const aliceConnections = await aliceAgent.getConnections();
    console.log('aliceConnections', aliceConnections);

    const bobConnections = await bobAgent.getConnections();
    console.log('bobConnections', bobConnections);

    // send message from Alice to Bob
    const message = 'hello, world';
    await aliceAgent.sendMessageToConnection(aliceConnections[0], message);

    const bobMessages = await poll(
      () => {
        console.log(`Getting Bob's connection messages...`);
        const connections = bobAgent.getConnections();
        return connections[0].messages;
      },
      messages => messages.length < 1
    );
    console.log(bobMessages);
    expect(bobMessages[0].content).toBe(message);
  });
});

class SubjectOutboundTransporter {
  constructor(subject) {
    this.subject = subject;
  }

  sendMessage(outboundPackage) {
    console.log('Sending message...');
    const { payload } = outboundPackage;
    console.log(payload);
    this.subject.next(payload);
  }
}

function subscribe(agent, subject) {
  subject.subscribe({
    next: message => agent.receiveMessage(message),
  });
}
