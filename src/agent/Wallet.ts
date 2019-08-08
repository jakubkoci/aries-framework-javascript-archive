import indy from 'indy-sdk';
import logger from '../logger';
import { OutboundMessage, InboundMessage, Message } from '../types';
import { sign } from '../decorators';

interface Wallet {
  init(): Promise<void>;
  createDid(didConfig?: DidConfig): Promise<[Did, Verkey]>;
  keyForLocalDid(did: Did): Promise<Verkey>;
  pack(payload: {}, recipientKeys: Verkey[], senderVk: Verkey | null): Promise<JsonWebKey>;
  unpack(messagePackage: JsonWebKey): Promise<InboundMessage>;
  sign(message: Message, attribute: string, verkey: Verkey): Promise<Message>;
  verify(signerVerkey: Verkey, data: Buffer, signature: Buffer): Promise<boolean>;
}

type DidConfig = {
  did: string;
  seed: string;
};

type WalletConfig = {
  id: string;
};

type WalletCredentials = {
  key: string;
};

class IndyWallet implements Wallet {
  wh?: number;
  walletConfig: WalletConfig;
  walletCredentials: WalletCredentials;

  constructor(walletConfig: WalletConfig, walletCredentials: WalletCredentials) {
    this.walletConfig = walletConfig;
    this.walletCredentials = walletCredentials;
  }

  async init() {
    try {
      await indy.createWallet(this.walletConfig, this.walletCredentials);
    } catch (error) {
      if (error.indyName && error.indyName === 'WalletAlreadyExistsError') {
        logger.log(error.indyName);
      } else {
        throw error;
      }
    }

    this.wh = await indy.openWallet(this.walletConfig, this.walletCredentials);
    logger.log(`Wallet opened with handle: ${this.wh}`);
  }

  createDid(didConfig?: DidConfig): Promise<[string, string]> {
    if (!this.wh) {
      throw Error('Wallet has not been initialized yet');
    }

    return indy.createAndStoreMyDid(this.wh, didConfig || {});
  }

  keyForLocalDid(did: Did) {
    if (!this.wh) {
      throw Error('Wallet has not been initialized yet');
    }

    return indy.keyForLocalDid(this.wh, did);
  }

  async pack(payload: {}, recipientKeys: Verkey[], senderVk: Verkey): Promise<JsonWebKey> {
    if (!this.wh) {
      throw Error('Wallet has not been initialized yet');
    }

    const messageRaw = Buffer.from(JSON.stringify(payload), 'utf-8');
    const packedMessage = await indy.packMessage(this.wh, messageRaw, recipientKeys, senderVk);
    return JSON.parse(packedMessage.toString('utf-8'));
  }

  async unpack(messagePackage: JsonWebKey): Promise<InboundMessage> {
    if (!this.wh) {
      throw Error('Wallet has not been initialized yet');
    }

    const unpackedMessageBuffer = await indy.unpackMessage(
      this.wh,
      Buffer.from(JSON.stringify(messagePackage), 'utf-8')
    );
    const unpackedMessage = JSON.parse(unpackedMessageBuffer.toString('utf-8'));
    return {
      ...unpackedMessage,
      message: JSON.parse(unpackedMessage.message),
    };
  }

  async sign(message: Message, attribute: string, verkey: Verkey) {
    if (!this.wh) {
      throw Error('Wallet has not been initialized yet');
    }

    return sign(this.wh, message, attribute, verkey);
  }

  async verify(signerVerkey: Verkey, data: Buffer, signature: Buffer) {
    return indy.cryptoVerify(signerVerkey, data, signature);
  }
}

export { Wallet, IndyWallet };
