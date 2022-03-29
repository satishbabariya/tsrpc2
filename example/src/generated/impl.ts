import { createServer } from "http";
import {
  EchoRequest,
  EchoResponse,
  IEchoService,
  IEchoService2,
  tsRPC2,
} from "./server";

class EchoService implements IEchoService {
  async echo(request: EchoRequest): Promise<EchoResponse> {
    return { message: request.message };
  }
  async get(): Promise<EchoResponse> {
    return { message: "Hello, world!" };
  }
}

class EchoService2 implements IEchoService2 {
  async echo(request: EchoRequest): Promise<EchoResponse> {
    return { message: request.message };
  }
  async get(): Promise<EchoResponse> {
    throw new Error("Method not implemented.");
  }
}

const tsrpc = tsRPC2();
tsrpc.registerEchoService(new EchoService(), []);
tsrpc.registerEchoService2(new EchoService2(), []);

console.log(tsrpc.routes);

const server = createServer((request, response) => {
  tsrpc.handleRequest(request, response);
});

server.listen(3000);
