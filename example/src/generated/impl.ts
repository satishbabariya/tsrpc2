import { EchoRequest, EchoResponse, IEchoService } from "./server";

class EchoService implements IEchoService {
  async echo(request: EchoRequest): Promise<EchoResponse> {
    throw new Error("Method not implemented.");
  }
  async get(): Promise<EchoResponse> {
    throw new Error("Method not implemented.");
  }
}
