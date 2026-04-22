import { SocksClient } from "socks";
import { log } from "./../utils/index.js";

export interface Socks5Config {
  host: string;
  port: number;
  userId?: string;
  password?: string;
}

/**
 * Creates a stream factory function for mysql2 that routes connections through a SOCKS5 proxy.
 * mysql2 calls this function for each new connection, passing a callback `(err, stream)`.
 */
export function createSocks5StreamFactory(
  socks5: Socks5Config,
  destination: { host: string; port: number },
) {
  return (callback: (err: Error | null, stream?: NodeJS.ReadWriteStream) => void) => {
    SocksClient.createConnection({
      proxy: {
        host: socks5.host,
        port: socks5.port,
        type: 5,
        ...(socks5.userId ? { userId: socks5.userId } : {}),
        ...(socks5.password ? { password: socks5.password } : {}),
      },
      command: "connect",
      destination,
    })
      .then(({ socket }) => {
        log("info", `SOCKS5 connection established via ${socks5.host}:${socks5.port}`);
        callback(null, socket);
      })
      .catch((err: Error) => {
        log("error", `SOCKS5 connection failed: ${err.message}`);
        callback(err);
      });
  };
}
