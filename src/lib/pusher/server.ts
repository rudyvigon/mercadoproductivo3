import Pusher from "pusher";

let _pusher: Pusher | null = null;

export function getPusher() {
  if (_pusher) return _pusher;
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    throw new Error("CONFIG_ERROR_PUSHER_ENV");
  }

  _pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
  return _pusher;
}
