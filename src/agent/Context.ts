import { Wallet } from "./Wallet";
import { InitConfig, Agency } from "./types";

export interface Context {
  config: InitConfig;
  wallet: Wallet;
  agency?: Agency;
}