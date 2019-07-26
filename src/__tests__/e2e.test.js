/* eslint-disable */
const { get, post } = require('../http');

test('make a connection', async () => {
  const invitation = await get('http://localhost:3001/invitation');
  const response = await post('http://localhost:3002/invitation', invitation);
  const responseText = await console.log(response);

  // TODO Poll connections instead of wait
  // Poll connection by Alice -> Bob invitation's verkey post(`http://localhost:3001/api/connections/${aliceVerkeyAtAliceBob}`, message);
  // Poll connection by Alice -> Bob connection's theirKey post(`http://localhost:3002/api/connections/${aliceVerkeyAtAliceBob}`, message);
  await wait(2000);

  const aliceConnectionsResponse = await get('http://localhost:3001/connections');
  console.log(aliceConnectionsResponse);

  const bobConnectionsResponse = await get('http://localhost:3002/connections');
  console.log(bobConnectionsResponse);

  const aliceConnections = JSON.parse(aliceConnectionsResponse);
  const bobConnections = JSON.parse(bobConnectionsResponse);

  expect(aliceConnections.length).toBe(1);
  expect(bobConnections.length).toBe(1);
  expect(aliceConnections[0].did).toBe(bobConnections[0].theirDid);
  expect(aliceConnections[0].verkey).toBe(bobConnections[0].theirKey);
  expect(bobConnections[0].did).toBe(aliceConnections[0].theirDid);
  expect(bobConnections[0].verkey).toBe(aliceConnections[0].theirKey);
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
  const bobMessagesResponse = await get(
    `http://localhost:3002/api/connections/${bobVerkeyAtAliceBob}/messages`,
    message
  );
  const bobMessages = JSON.parse(bobMessagesResponse);
  console.log(bobMessages);
  expect(bobMessages[0].content).toBe(message);
});

function wait(ms = 1000) {
  return new Promise(resolve => {
    console.log(`waiting ${ms} ms...`);
    setTimeout(resolve, ms);
  });
}
