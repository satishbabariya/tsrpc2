import commander from "commander";

const pkg = require("../package.json");

let program: commander.Command;

async function main() {
  program = new commander.Command();
  program.version(`${pkg.version}`);

  program
    .command("init")
    .alias("i")
    .description("Initialize a new project")
    .action(() => {
      console.log("Initializing a new project");
    });

  program.parse(process.argv);
}

main();
