import commander from "commander";
import { InterfaceDeclaration, Project } from "ts-morph";
import { format } from "prettier";

// Service interface
export interface Service {}

function generate(protoPath: any, server: any, outputPath: any, client: any) {
  let project = new Project();
  project.addSourceFileAtPath(protoPath);

  let generatedFile = project.createSourceFile(
    `${outputPath}/server.d.ts`,
    "",
    { overwrite: true }
  );

  let clientFile = project.createSourceFile(`${outputPath}/client.ts`, "", {
    overwrite: true,
  });

  let interfacesToExport: InterfaceDeclaration[] = [];

  let sourceFiles = project.getSourceFiles();
  sourceFiles.forEach((sourceFile) => {
    let interfaces = sourceFile.getInterfaces();
    interfaces.forEach((interfaceDeclaration) => {
      let extendsTypes = interfaceDeclaration
        .getExtends()
        .map((extendsType) => extendsType.getText());

      if (extendsTypes.includes("Service")) {
        let unimplementedInterface = generatedFile.addInterface({
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

        clientImpl.addConstructor({
          parameters: [
            {
              name: "baseUrl",
              type: "string",
              initializer: `"/"`,
            },
          ],
          statements: [`this.baseUrl = baseUrl;`],
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
    generatedFile.addInterface({
      ...interfaceDeclaration.getStructure(),
      isExported: true,
    });
    clientFile.addInterface({
      ...interfaceDeclaration.getStructure(),
      isExported: true,
    });
  });

  generatedFile.replaceWithText(
    format(generatedFile.getFullText(), { parser: "typescript" })
  );

  clientFile.replaceWithText(
    format(clientFile.getFullText(), { parser: "typescript" })
  );

  if (server) {
    // generatedFile.formatText();
    generatedFile.saveSync();
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
