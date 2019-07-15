declare module 'indy-sdk' {
  function createWallet(config: {}, credentials: {}): void;
  function openWallet(config: {}, credentials: {}): number;
  function createAndStoreMyDid(walletHandle: number, credentials: {}): [string, string];
}
