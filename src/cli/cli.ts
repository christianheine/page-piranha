#!./node_modules/.bin/ts-node

import { JorEl } from "jorel";
import { config } from "dotenv";
import { PagePiranha } from "../piranha";
import { piranhaArt } from "./ascii";
import { mkdir, writeFile } from "fs/promises";
import { Command } from "commander";
import path from "path";

export const pagePiranhaCli = async () => {
  const ora = await import("ora").then((m) => m.default);
  const chalk = await import("chalk").then((m) => m.default);

  config();

  const program = new Command();

  program
    .option("-f, --file <file>", "The file to convert")
    .option("-m, --mode <mode>", "Mode of conversion (text|markdown|json)", "text")
    .option(
      "-o, --outDir <directory>",
      "Output directory (optional when piping. Set to - to force pipe mode)",
      "out",
    )
    .option("-t, --tee", "Output to stdout and file")
    .option("-v, --verbose", "Verbose output", false)
    .option("-p, --prompt <prompt>", "Additional hints for the conversion")
    .parse();

  const options = program.opts();

  const { file, mode, outDir, prompt } = options;

  const isPiped = !process.stdout.isTTY;

  const verboseMode = !!options.verbose && !isPiped;

  if (!file) {
    console.error("Error: Input file is required");
    process.exit(1);
  }

  if (!["text", "markdown", "json"].includes(mode)) {
    console.error("Error: Mode must be one of: text, markdown, json");
    process.exit(1);
  }

  // Determine if we should output to stdout
  const useStdout = isPiped || outDir === "-";

  // Only require outDir if we're not piping
  if (!useStdout && !outDir) {
    console.error("Error: Output directory is required when not piping");
    process.exit(1);
  }

  // Resolve input path
  const absoluteFilePath = path.resolve(file);

  // Only show art and progress when not piping
  if (!useStdout) {
    console.log(chalk.cyan(piranhaArt));
    console.log(chalk.cyan.bold(" P A G E   P I R A N H A"));
    console.log("\n");
  }

  const logToConsole = (level: string, message: string) => {
    if (level === "error") {
      console.error(chalk.red(`${message}`));
    } else if (level === "warn") {
      console.warn(chalk.yellow(`${message}`));
    } else if (level === "info") {
      console.log(chalk.blue(`${message}`));
    } else {
      console.log(chalk.gray(`${message}`));
    }
  };

  // Initialize JorEl
  const jorEl = new JorEl({
    vertexAi: true,
    logger: logToConsole,
    logLevel: verboseMode ? "debug" : isPiped ? "silent" : "error",
  });

  // Initialize PagePiranha
  const piranha = new PagePiranha(jorEl);

  let result: string;
  let spinner;

  if (!useStdout) {
    console.log(`Using model "${piranha.model}" to convert files to "${mode}".`);

    if (verboseMode) {
      console.log(`Ingesting ${chalk.white.bold(file)}...`);
    } else {
      spinner = ora({
        text: `Ingesting ${chalk.white.bold(file)}...`,
        color: "cyan",
        spinner: "dots",
      }).start();
    }
  }

  try {
    if (mode === "markdown") {
      result = await piranha.toMarkdown(absoluteFilePath, prompt);
    } else if (mode === "text") {
      result = await piranha.toText(absoluteFilePath, prompt);
    } else {
      result = JSON.stringify(await piranha.toJson(absoluteFilePath, prompt), null, 2);
    }

    if (!result) {
      if (verboseMode) {
        console.error("Error: Conversion failed");
      } else {
        if (spinner) spinner.fail("Conversion failed");
      }
      process.exit(1);
    }

    if (verboseMode) {
      console.log("Conversion complete!");
    } else if (spinner) {
      spinner.succeed("Conversion complete!");
    }

    if (useStdout) {
      // Output to stdout
      process.stdout.write(result);
    } else {
      // Output to file
      const absoluteOutDir = path.resolve(outDir);
      await mkdir(absoluteOutDir, { recursive: true });

      const outExt = mode === "markdown" ? "md" : mode === "json" ? "json" : "txt";
      const parsedInputPath = path.parse(absoluteFilePath);
      const outputPath = path.join(absoluteOutDir, `${parsedInputPath.name}.${outExt}`);

      await writeFile(outputPath, result);

      console.log(`\nYummy! Output was saved to: ${outputPath}`);

      if (options.tee) {
        console.log(
          chalk.green(
            "\n" +
              "------------------------\n" +
              "      O U T P U T       \n" +
              "------------------------\n",
          ),
        );
        process.stdout.write(result);
        process.stdout.write("\n");
      }
    }
  } catch (error) {
    if (spinner) spinner.fail("Conversion failed");

    if (error instanceof Error) {
      console.error("Error:", error.message);
    } else {
      console.error("Error:", error);
    }
    process.exit(1);
  }
};
