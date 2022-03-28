export interface IEchoService {
  echo(request: EchoRequest): Promise<EchoResponse>;
  get(): Promise<EchoResponse>;
}

export class EchoServiceClient implements IEchoService {
  baseUrl: string;
  headers: { [key: string]: string };

  constructor(baseUrl: string = "/", headers: { [key: string]: string } = {}) {
    this.baseUrl = baseUrl;
    this.headers = headers;
  }

  async echo(request: EchoRequest): Promise<EchoResponse> {
    let response = await fetch(this.baseUrl + "/rpc/EchoService/echo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify({
        request,
      }),
    });
    return response.json();
  }

  async get(): Promise<EchoResponse> {
    let response = await fetch(this.baseUrl + "/rpc/EchoService/get", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
    });
    return response.json();
  }
}

export interface IEchoService2 {
  echo(request: EchoRequest): Promise<EchoResponse>;
  get(): Promise<EchoResponse>;
}

export class EchoService2Client implements IEchoService2 {
  baseUrl: string;
  headers: { [key: string]: string };

  constructor(baseUrl: string = "/", headers: { [key: string]: string } = {}) {
    this.baseUrl = baseUrl;
    this.headers = headers;
  }

  async echo(request: EchoRequest): Promise<EchoResponse> {
    let response = await fetch(this.baseUrl + "/rpc/EchoService2/echo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify({
        request,
      }),
    });
    return response.json();
  }

  async get(): Promise<EchoResponse> {
    let response = await fetch(this.baseUrl + "/rpc/EchoService2/get", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
    });
    return response.json();
  }
}

export interface EchoResponse {
  message: string;
}

export interface EchoRequest {
  message: string;
}
