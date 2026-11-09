import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { syncBuiltinESMExports } from "node:module";

let attempts = 0;
const deny = (): never => { attempts++; throw new Error("External network disabled in transport tests"); };
http.request = deny as typeof http.request;
http.get = deny as typeof http.get;
https.request = deny as typeof https.request;
https.get = deny as typeof https.get;
net.connect = deny as typeof net.connect;
net.createConnection = deny as typeof net.createConnection;
net.Socket.prototype.connect = deny as typeof net.Socket.prototype.connect;
tls.connect = deny as typeof tls.connect;
globalThis.fetch = deny;
syncBuiltinESMExports();
export const networkAttempts = () => attempts;
