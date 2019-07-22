/* eslint-disable */
const fetch = require('node-fetch');

test('make a connection', async () => {
  const invitation = await get('http://localhost:3001/invitation');
  const connectinRequest = await post('http://localhost:3002/invitation', invitation);
  const connectionResponse = await post('http://localhost:3001/msg', connectinRequest);
  const ack = await post('http://localhost:3002/msg', connectionResponse);

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

async function get(url) {
  const response = await fetch(url);
  return response.text();
}

async function post(url, body) {
  const response = await fetch(url, { method: 'POST', body });
  return response.text();
}
