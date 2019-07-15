import indy from 'indy-sdk';

async function init() {
  const walletConfig = { id: 'wallet-1' };
  const walletCredentials = { key: 'key' };

  await indy.createWallet(walletConfig, walletCredentials);
  const wh = await indy.openWallet(walletConfig, walletCredentials);

  // List, create, and get
  const [did, verkey] = await indy.createAndStoreMyDid(wh, { seed: '000000000000000000000000Steward1' });
  console.log(did, verkey);
}

function main() {
  init();
}

main();
