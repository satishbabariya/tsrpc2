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
