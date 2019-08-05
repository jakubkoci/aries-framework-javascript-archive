/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */
const { Subject } = require('rxjs');
const { Agent } = require('../Agent');
const { decodeInvitationFromUrl } = require('../../helpers');
const { poll } = require('../../polling');

const aliceWalletConfig = {
  walletId: 'alice',
  walletSeed: '00000000000000000000000000000Test01',
};

const bobWalletConfig = {
  walletId: 'bob',
  walletSeed: '00000000000000000000000000000Test02',
};

describe('agents', () => {
  let aliceAgent;
  let bobAgent;

  test('make a connection between agents', async () => {
    const aliceMessages = new Subject();
    const bobMessages = new Subject();

    const aliceAgentSender = new ArrayMessageSender(bobMessages);
    const bobAgentSender = new ArrayMessageSender(aliceMessages);

    aliceAgent = new Agent('Alice', aliceWalletConfig, aliceAgentSender);
    await aliceAgent.init();

    bobAgent = new Agent('Bob', bobWalletConfig, bobAgentSender);
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
      200
    );
    console.log('aliceConnectionAtAliceBob\n', aliceConnectionAtAliceBob);

    const bobKeyAtBobAlice = aliceConnectionAtAliceBob.theirKey;
    const bobConnectionAtBobAlice = await poll(
      () => bobAgent.findConnectionByMyKey(bobKeyAtBobAlice),
      connection => connection.state !== 4,
      200
    );
    console.log('bobConnectionAtAliceBob\n', bobConnectionAtBobAlice);

    expect(aliceConnectionAtAliceBob.did).toBe(bobConnectionAtBobAlice.theirDid);
    expect(aliceConnectionAtAliceBob.verkey).toBe(bobConnectionAtBobAlice.theirKey);
    expect(bobConnectionAtBobAlice.did).toBe(aliceConnectionAtAliceBob.theirDid);
    expect(bobConnectionAtBobAlice.verkey).toBe(aliceConnectionAtAliceBob.theirKey);
  });

  test('send a message to connection', async () => {
    const aliceConnections = await aliceAgent.getConnections();
    console.log(aliceConnections);

    const bobConnections = await bobAgent.getConnections();
    console.log(bobConnections);

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

function subscribe(agent, subject) {
  subject.subscribe({
    next: message => agent.receiveMessage(message),
  });
}

class ArrayMessageSender {
  constructor(subject) {
    this.subject = subject;
  }

  sendMessage(message) {
    console.log('Sending message...');
    console.log(message);
    this.subject.next(message);
  }
}
