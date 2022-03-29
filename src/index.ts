import commander from "commander";
import { InterfaceDeclaration, Project } from "ts-morph";
import { format } from "prettier";

function generate(protoPath: any, server: any, outputPath: any, client: any) {
  let project = new Project();
  project.addSourceFileAtPath(protoPath);

  let serverFile = project.createSourceFile(`${outputPath}/server.ts`, "", {
    overwrite: true,
  });

  let clientFile = project.createSourceFile(`${outputPath}/client.ts`, "", {
    overwrite: true,
  });

  let interfacesToExport: InterfaceDeclaration[] = [];

  // serverFile.addImportDeclaration({
  //   moduleSpecifier: "http",
  //   namedImports: ["IncomingMessage", "ServerResponse"],
  // });

  serverFile.addStatements(`
    import { IncomingMessage, ServerResponse } from "http";

    type Request = IncomingMessage & { rawBody: string };

    type Interceptor = (
      request: IncomingMessage,
      response: ServerResponse,
      next: (request: IncomingMessage, response: ServerResponse) => void
    ) => void;
    `);

  // http and routing
  let trpcServerClassDecl = serverFile.addClass({
    name: "RPCServer",
    isExported: true,
  });

  trpcServerClassDecl.addProperty({
    name: "routes",
    type: `{
      [key: string]: {
        action: Function;
        interceptors: Interceptor[];
        method: string;
        params: string[];
      };
    }`,
    initializer: "{}",
  });

  trpcServerClassDecl.addMethod({
    name: "parseBody",
    returnType: "Promise<Request>",
    parameters: [
      {
        name: "req",
        type: "IncomingMessage",
      },
    ],
    statements: [
      `return new Promise<Request>((resolve, reject) => {
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
      });`,
    ],
  });

  trpcServerClassDecl.addMethod({
    name: "handleRequest",
    isAsync: true,
    parameters: [
      {
        name: "request",
        type: "IncomingMessage",
      },
      {
        name: "response",
        type: "ServerResponse",
      },
    ],
    statements: [
      `
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
                throw new Error('Invalid params');
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
      `,
    ],
  });

  let sourceFiles = project.getSourceFiles();
  sourceFiles.forEach((sourceFile) => {
    let interfaces = sourceFile.getInterfaces();
    interfaces.forEach((interfaceDeclaration) => {
      let extendsTypes = interfaceDeclaration
        .getExtends()
        .map((extendsType) => extendsType.getText());

      if (extendsTypes.includes("Service")) {
        let unimplementedInterface = serverFile.addInterface({
          name: `I${interfaceDeclaration.getName()}`,
          isExported: true,
        });

        let unimplementedMethods = interfaceDeclaration.getMethods();

        unimplementedMethods.forEach((method) => {
          let returnType = method.getReturnType().getText();
          let responseType = returnType
            .replace("Promise<", "")
            .replace(">", "");

          // find the response type from interfaces
          let responseInterface = interfaces.find(
            (interfaceNode) => interfaceNode.getName() === responseType
          );
          // add the response type to the file
          if (responseInterface) {
            if (!interfacesToExport.includes(responseInterface)) {
              interfacesToExport.push(responseInterface);
            }
          }

          let parameters = method
            .getParameters()
            .map((param) => param.getStructure());

          parameters.forEach((param) => {
            let paramInterface = interfaces.find(
              (interfaceNode) => interfaceNode.getName() === param.type
            );

            if (paramInterface) {
              if (!interfacesToExport.includes(paramInterface)) {
                interfacesToExport.push(paramInterface);
              }
            }
          });

          unimplementedInterface.addMethod({
            name: method.getName(),
            parameters: parameters,
            returnType: `Promise<${responseType}>`,
          });
        });

        trpcServerClassDecl.addMethod({
          name: `register${interfaceDeclaration.getName()}`,
          parameters: [
            {
              name: "service",
              type: unimplementedInterface.getName(),
            },
            {
              name: "interceptors",
              type: "Interceptor[]",
            },
          ],
          statements: [
            ...unimplementedMethods.map((method) => {
              return `this.routes['/rpc/${interfaceDeclaration.getName()}/${method.getName()}'] = {
                action: service.${method.getName()},
                interceptors: interceptors,
                method: '${method.getParameters().length > 0 ? "POST" : "GET"}',
                params: ${JSON.stringify(
                  method.getParameters().map((param) => param.getName())
                )},
              };`;
            }),
          ],
        });

        clientFile.addInterface({
          ...unimplementedInterface.getStructure(),
          isExported: true,
        });

        let clientImpl = clientFile.addClass({
          name: `${interfaceDeclaration.getName()}Client`,
          isExported: true,
          implements: [`I${interfaceDeclaration.getName()}`],
        });

        clientImpl.addProperty({
          name: "baseUrl",
          type: "string",
        });

        clientImpl.addProperty({
          name: "headers",
          type: "{ [key: string]: string }",
        });

        clientImpl.addConstructor({
          parameters: [
            {
              name: "baseUrl",
              type: "string",
              initializer: `"/"`,
            },
            {
              name: "headers",
              type: "{ [key: string]: string }",
              initializer: "{}",
            },
          ],
          statements: [`this.baseUrl = baseUrl;`, `this.headers = headers;`],
        });

        unimplementedMethods.forEach((method) => {
          let returnType = method.getReturnType().getText();
          let responseType = returnType
            .replace("Promise<", "")
            .replace(">", "");

          let methodImpl = clientImpl.addMethod({
            name: method.getName(),
            parameters: method
              .getParameters()
              .map((param) => param.getStructure()),
            returnType: `Promise<${responseType}>`,
            isAsync: true,
          });

          let route = `/rpc/${interfaceDeclaration.getName()}/${method.getName()}`;
          if (method.getParameters().length > 0) {
            methodImpl.addStatements(
              `let response = await fetch(this.baseUrl+"${route}", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...this.headers,
                  },
                  body: JSON.stringify({
                    ${method.getParameters().map((param) => param.getName())}
                  }),
                });
                return response.json();`
            );
          } else {
            methodImpl.addStatements(
              `let response = await fetch(this.baseUrl+"${route}", {
                  method: "GET",
                  headers: {
                    "Content-Type": "application/json",
                    ...this.headers,
                  },
              });
              return response.json();`
            );
          }
        });
      }
    });
  });

  // add the interfaces to the file
  interfacesToExport.forEach((interfaceDeclaration) => {
    serverFile.addInterface({
      ...interfaceDeclaration.getStructure(),
      isExported: true,
    });
    clientFile.addInterface({
      ...interfaceDeclaration.getStructure(),
      isExported: true,
    });
  });

  serverFile.addFunction({
    name: "tsRPC2",
    returnType: "RPCServer",
    statements: [`return new RPCServer();`],
    isExported: true,
  });

  serverFile.replaceWithText(
    format(serverFile.getFullText(), { parser: "typescript" })
  );

  clientFile.replaceWithText(
    format(clientFile.getFullText(), { parser: "typescript" })
  );

  if (server) {
    // generatedFile.formatText();
    serverFile.saveSync();
  }

  if (client) {
    // clientFile.formatText();
    clientFile.saveSync();
  }
}

const pkg = require("../package.json");

let program: commander.Command;

async function main() {
  program = new commander.Command();
  program.version(`${pkg.version}`);

  program
    .command("generate")
    .alias("g")
    .description("Generate server and client code from proto files")
    .requiredOption("-p, --proto-path <path>", "Path to proto files")
    .requiredOption("-o, --output-path <path>", "Path to output files")
    .option("--client", "Generate client code", true)
    .option("--server", "Generate server code", true)
    .action((options) => {
      const { protoPath, outputPath, client, server } = options;
      generate(protoPath, server, outputPath, client);
    });

  program.parse(process.argv);
}

main();
