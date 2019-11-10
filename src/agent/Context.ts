import logger from '../logger';
import { Wallet } from './Wallet';
import { InitConfig, Agency } from './types';
import { MessageSender } from './MessageSender';

export interface Context {
  config: InitConfig;
  wallet: Wallet;
  agency?: Agency;
  messageSender: MessageSender;
}
