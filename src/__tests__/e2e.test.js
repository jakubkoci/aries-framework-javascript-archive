/* eslint-disable */
const { get, post } = require('../http');
const { parseInvitationUrl } = require('../helpers');
const { poll } = require('../polling');

test('make a connection', async () => {
  const invitationUrl = await get('http://localhost:3001/invitation');
  await post('http://localhost:3002/invitation', invitationUrl);

  const invitation = parseInvitationUrl(invitationUrl);
  const aliceKeyAtAliceBob = invitation.recipientKeys[0];

  const aliceConnectionAtAliceBob = await poll(
    () => getConnection(`http://localhost:3001/api/connections/${aliceKeyAtAliceBob}`),
    res => res.state !== 4,
    200
  );
  console.log('aliceConnectionAtAliceBob\n', aliceConnectionAtAliceBob);

  const bobConnectionAtAliceBob = await poll(
    () => getConnection(`http://localhost:3002/api/connections/${aliceConnectionAtAliceBob.theirKey}`),
    res => res.state !== 4,
    200
  );
  console.log('bobConnectionAtAliceBob\n', bobConnectionAtAliceBob);

  expect(aliceConnectionAtAliceBob.did).toBe(bobConnectionAtAliceBob.theirDid);
  expect(aliceConnectionAtAliceBob.verkey).toBe(bobConnectionAtAliceBob.theirKey);
  expect(bobConnectionAtAliceBob.did).toBe(aliceConnectionAtAliceBob.theirDid);
  expect(bobConnectionAtAliceBob.verkey).toBe(aliceConnectionAtAliceBob.theirKey);
});

test('send a message to connection', async () => {
  const aliceConnectionsResponse = await get('http://localhost:3001/connections');
  console.log(aliceConnectionsResponse);

  const bobConnectionsResponse = await get('http://localhost:3002/connections');
  console.log(bobConnectionsResponse);

  const aliceConnections = JSON.parse(aliceConnectionsResponse);
  const bobConnections = JSON.parse(bobConnectionsResponse);

  // send message from Alice to Bob
  const aliceVerkeyAtAliceBob = aliceConnections[0].verkey;
  const message = 'hello, world';
  await post(`http://localhost:3001/api/connections/${aliceVerkeyAtAliceBob}/send-message`, message);

  const bobVerkeyAtAliceBob = bobConnections[0].verkey;
  const bobMessagesResponse = await get(`http://localhost:3002/api/connections/${bobVerkeyAtAliceBob}/messages`);
  const bobMessages = JSON.parse(bobMessagesResponse);
  console.log(bobMessages);
  expect(bobMessages[0].content).toBe(message);
});

async function getConnection(url) {
  const response = await get(url);
  return JSON.parse(response || '{}');
}
