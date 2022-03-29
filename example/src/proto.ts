import { Service } from "tsrpc2";

interface EchoRequest {
  message: string;
}

interface EchoResponse {
  message: string;
}

interface EchoService extends Service {
  echo(request: EchoRequest): EchoResponse;
  get(): EchoResponse;
}

interface EchoService2 extends Service {
  echo(request: EchoRequest): EchoResponse;
  get(): EchoResponse;
}
