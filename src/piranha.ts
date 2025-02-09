import { ImageContent, JorEl } from "jorel";

/**
 * Options for the PagePiranha.
 */
export interface PagePiranhaOptions {
  model?: string;
  prompt?: string;
}

/**
 * The input type for the PagePiranha class.
 */
export type PagePiranhaInput = string | Buffer;

/**
 * PagePiranha is a utility class for converting PDF documents to various formats
 * using Large Language Models (LLMs) through the JorEl interface.
 */
export class PagePiranha {
  /**
   * The JorEl instance which will be used to interface with the LLM.
   * @internal
   */
  private jorEl: JorEl;

  /**
   * The model to use for the conversion.
   */
  public model: string = "gemini-2.0-flash-001";

  /**
   * Constructs a new PagePiranha instance.
   * @param joreEl - The JorEl instance to use for LLM interactions.
   * @param options - Additional options.
   */
  constructor(joreEl: JorEl, options?: PagePiranhaOptions) {
    this.jorEl = joreEl;
    if (options?.model) this.model = options.model;
  }

  /**
   * Prepares the contents for conversion.
   * @param fileOrFiles - The file or files to convert.
   * @returns The prepared contents.
   * @internal
   */
  private async prepareContents(fileOrFiles: PagePiranhaInput | PagePiranhaInput[]) {
    try {
      const contents: ImageContent[] = [];
      const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];

      for (const file of files) {
        if (typeof file === "string") {
          if (file.startsWith("http")) {
            contents.push(await ImageContent.fromUrl(file));
          } else {
            contents.push(await ImageContent.fromFile(file));
          }
        } else {
          contents.push(await ImageContent.fromBuffer(file));
        }
      }

      return contents;
    } catch (error: any) {
      throw new Error(`Failed to prepare contents: ${error.message}`);
    }
  }

  /**
   * Converts the given file or files to the specified format.
   * @param fileOrFiles - The file or files to convert.
   * @param prompt - The prompt to use for the conversion.
   * @param json - Whether to return the response as JSON.
   */
  public async convert(
    fileOrFiles: PagePiranhaInput | PagePiranhaInput[],
    prompt: string,
    json: false,
  ): Promise<string>;
  public async convert(
    fileOrFiles: PagePiranhaInput | PagePiranhaInput[],
    prompt: string,
    json: true,
  ): Promise<object>;
  public async convert(
    fileOrFiles: PagePiranhaInput | PagePiranhaInput[],
    prompt: string,
    json: boolean = false,
  ): Promise<string | object> {
    try {
      const contents = await this.prepareContents(fileOrFiles);

      if (json) {
        const { response, meta } = await this.jorEl.json(
          [prompt, ...contents],
          {
            model: this.model,
          },
          true,
        );
        this.jorEl.logger.info(
          "convert",
          `Converted PDFs to JSON using model ${meta.model}, input tokens ${meta.inputTokens}, and output tokens ${meta.outputTokens}.`,
        );
        return response;
      } else {
        const { response, meta } = await this.jorEl.ask(
          [prompt, ...contents],
          {
            model: this.model,
          },
          true,
        );

        this.jorEl.logger.info(
          "convert",
          `Converted PDFs to text using model ${meta.model}, input tokens ${meta.inputTokens}, and output tokens ${meta.outputTokens}.`,
        );
        return response;
      }
    } catch (error: any) {
      throw new Error(`Conversion failed: ${error.message}`);
    }
  }

  /**
   * Converts the given file or files to markdown.
   * @param fileOrFiles - The file or files to convert.
   * @param additionalPrompt - Additional hints for the conversion.
   */
  public async toMarkdown(
    fileOrFiles: PagePiranhaInput | PagePiranhaInput[],
    additionalPrompt?: string,
  ) {
    let prompt =
      "Convert the following PDFs to text (markdown). Be sure to include all of the text from the PDF.";

    if (additionalPrompt) {
      prompt += `\n\n${additionalPrompt}`;
    }

    // Generate response
    let response = await this.convert(fileOrFiles, prompt, false);

    // Clean up response (could be done by the model, but it's easier to do it here. Less for the model to worry about.)
    response = response.replace(/^```markdown/, "");
    response = response.replace(/^```/, "");
    response = response.replace(/```$/, "");
    response = response.trim();

    return response;
  }

  /**
   * Converts the given file or files to plain text.
   * @param fileOrFiles - The file or files to convert.
   * @param additionalPrompt - Additional hints for the conversion.
   */
  public async toText(
    fileOrFiles: PagePiranhaInput | PagePiranhaInput[],
    additionalPrompt?: string,
  ) {
    let prompt =
      "Convert the following PDFs to plain text. Be sure to include all of the text from the PDF.";

    if (additionalPrompt) {
      prompt += `\n\n${additionalPrompt}`;
    }

    // Generate response
    let response = await this.convert(fileOrFiles, prompt, false);

    response = response.trim();

    return response;
  }

  /**
   * Converts the given file or files to JSON.
   * @param fileOrFiles - The file or files to convert.
   * @param additionalPrompt - Additional hints for the conversion.
   */
  public async toJson(
    fileOrFiles: PagePiranhaInput | PagePiranhaInput[],
    additionalPrompt?: string,
  ) {
    let prompt =
      "Convert the following PDFs to JSON. Be sure to include all of the text from the PDF.";

    if (additionalPrompt) {
      prompt += `\n\n${additionalPrompt}`;
    }

    // Generate response
    return await this.convert(fileOrFiles, prompt, true);
  }
}
