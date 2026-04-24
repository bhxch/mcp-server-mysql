import { Duplex } from "stream";
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
 * mysql2 calls this function synchronously and expects a stream return value.
 * We return a Duplex stream immediately and connect the SOCKS5 tunnel in the background.
 */
export function createSocks5StreamFactory(
  socks5: Socks5Config,
  destination: { host: string; port: number },
  timeout?: number,
) {
  return () => {
    let socksSocket: import("net").Socket | null = null;
    const pendingWrites: Buffer[] = [];

    const proxyStream = new Duplex({
      read() { },
      write(chunk: Buffer, _encoding: string, callback: (error?: Error | null) => void) {
        if (socksSocket) {
          socksSocket.write(chunk);
        } else {
          pendingWrites.push(Buffer.from(chunk));
        }
        callback();
      },
    });

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
      timeout,
    })
      .then(({ socket }) => {
        socksSocket = socket;
        log("info", `SOCKS5 connection established via ${socks5.host}:${socks5.port}`);

        socket.on("data", (data: Buffer) => proxyStream.push(data));
        socket.on("end", () => proxyStream.push(null));
        socket.on("error", (err: Error) => proxyStream.emit("error", err));
        socket.on("close", () => proxyStream.destroy());

        for (const chunk of pendingWrites) {
          socket.write(chunk);
        }
        pendingWrites.length = 0;
      })
      .catch((err: Error) => {
        log("error", `SOCKS5 connection failed: ${err.message}`);
        proxyStream.emit("error", err);
      });

    return proxyStream;
  };
}
