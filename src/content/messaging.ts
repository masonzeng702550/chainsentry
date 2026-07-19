import type { Msg, MsgResponse } from '@/shared/messages';

export function send<R extends MsgResponse = MsgResponse>(msg: Msg): Promise<R> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (resp) => {
      const err = chrome.runtime.lastError;
      if (err) return reject(new Error(err.message));
      resolve(resp as R);
    });
  });
}
