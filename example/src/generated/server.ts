import { IncomingMessage, ServerResponse } from "http";

type Request = IncomingMessage & { rawBody: string };

type Interceptor = (
  request: Request,
  response: ServerResponse,
  next: (request: Request, response: ServerResponse) => void
) => void;

export class RPCServer {
  routes: {
    [key: string]: {
      action: Function;
      interceptors: Interceptor[];
      method: string;
      params: string[];
    };
  } = {};

  parseBody(req: IncomingMessage): Promise<Request> {
    return new Promise<Request>((resolve, reject) => {
      (req as IncomingMessage & { rawBody: string }).rawBody = "";
      req.setEncoding("utf8");
      req.on("data", (chunk: string) => {
        (req as IncomingMessage & { rawBody: string }).rawBody += chunk;
      });
      req.on("end", () => {
        resolve(req as Request);
      });
      req.on("error", (error: any) => {
        reject(error);
      });
    });
  }

  async handleRequest(request: IncomingMessage, response: ServerResponse) {
    try {
      let url = request.url;
      if (url) {
        let route = this.routes[url];
        if (route && route.method === request.method) {
          if (request.method === "GET") {
            let res = await route.action();
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(JSON.stringify(res));
            return;
          } else if (request.method === "POST") {
            const req = await this.parseBody(request);
            let body = JSON.parse(req.rawBody);
            let params = route.params.map((p) => body[p]);
            if (params.length !== route.params.length) {
              throw new Error("Invalid params");
            }
            let res = await route.action(...params);
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(JSON.stringify(res));
            return;
          }
        }
      }
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "not found" }));
    } catch (error: any) {
      response.writeHead(500, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: error.message }));
    }
  }

  registerEchoService(service: IEchoService, interceptors: Interceptor[]) {
    this.routes["/rpc/EchoService/echo"] = {
      action: service.echo,
      interceptors: interceptors,
      method: "POST",
      params: ["request"],
    };
    this.routes["/rpc/EchoService/get"] = {
      action: service.get,
      interceptors: interceptors,
      method: "GET",
      params: [],
    };
  }

  registerEchoService2(service: IEchoService2, interceptors: Interceptor[]) {
    this.routes["/rpc/EchoService2/echo"] = {
      action: service.echo,
      interceptors: interceptors,
      method: "POST",
      params: ["request"],
    };
    this.routes["/rpc/EchoService2/get"] = {
      action: service.get,
      interceptors: interceptors,
      method: "GET",
      params: [],
    };
  }
}

export interface IEchoService {
  echo(request: EchoRequest): Promise<EchoResponse>;
  get(): Promise<EchoResponse>;
}

export interface IEchoService2 {
  echo(request: EchoRequest): Promise<EchoResponse>;
  get(): Promise<EchoResponse>;
}

export interface EchoResponse {
  message: string;
}

export interface EchoRequest {
  message: string;
}

export function tsRPC2(): RPCServer {
  return new RPCServer();
}
