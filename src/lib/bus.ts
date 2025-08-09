import { EventEmitter } from "events";

export type FrontEvent = {
  type: string;
  connectionId?: string;
  channelId?: string;
  payload?: any;
  // 必要なら userId / clientId なども
};
class Bus extends EventEmitter {}

export const bus = new Bus();
