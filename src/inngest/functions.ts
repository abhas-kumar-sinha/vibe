import { Sandbox } from "@e2b/code-interpreter";
import { inngest } from "./client";
import { gemini, createAgent, createTool, createNetwork } from "@inngest/agent-kit";
import { getSandbox, lastAssistantTextMessageContent } from "./utils";
import { z } from "zod";
import { PROMPT } from "@/prompts";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {

    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("vibe-nextjs-base-template-scn-123");
      return sandbox.sandboxId;
    });

    const codeAgent = createAgent({
      name: "code-agent",
      description: "An expert coding agent that can write code, run commands, and manage files in a sandbox environment.",
      system: PROMPT,
      model: gemini({ model: "gemini-2.0-flash" }),
      tools: [
        createTool({
          name: "terminal",
          description: "Use the terminal to run commands in the sandbox environment.",
          parameters: z.object({
            command: z.string().describe("The command to run in the terminal."),
          }),
          handler: async ({ command }, { step }) => {
            return await step?.run("terminal", async () => {
              const buffers = {stdout: "", stderr: ""};

              try {
                const sandbox = await getSandbox(sandboxId);
                const result = await sandbox.commands.run(command, {
                  onStdout: (data: string) => {
                    buffers.stdout += data;
                  },
                  onStderr: (data: string) => {
                    buffers.stderr += data;
                  },
                });
                return result.stdout
              } catch (error) {
                console.error(`Command failed: ${error} \nstdout: ${buffers.stdout} \nstderr: ${buffers.stderr}`);

                return `Command failed: ${error} \nstdout: ${buffers.stdout} \nstderr: ${buffers.stderr}`
              }
            })
          }
        }),
        createTool({
          name: "createOrUpdateFile",
          description: "Create or update a file in the sandbox environment.",
          parameters: z.object({
            files: z.array(
              z.object({
                path: z.string().describe("The path of the file to create or update."),
                content: z.string().describe("The content of the file to create or update."),
              })
            )
          }), 
          handler: async ({ files }, { step, network }) => {
            const newFiles = await step?.run("createOrUpdateFiles", async () => {
              try{
                const updatedFiles = network.state.data.files || {};
                const sandbox = await getSandbox(sandboxId);

                for (const file of files) {
                  await sandbox.files.write(file.path, file.content);
                  updatedFiles[file.path] = file.content;
                }

                return updatedFiles;

              } catch (error) {
                console.error(`Failed to create or update files: ${error}`);

                return "Error:" + error;
              }

            });
            if (typeof newFiles === "object") {
              network.state.data.files = newFiles;
            }
          }
        }),
        createTool({
          name: "readFiles",
          description: "Read files from the sandbox environment.",
          parameters: z.object({
            paths: z.array(z.string().describe("The paths of the files to read."))
          }),
          handler: async({ paths }, { step }) => {
            return await step?.run("readFiles", async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                const contents = [];

                for (const path of paths) {
                  const content = await sandbox.files.read(path);
                  contents.push({ path, content });
                }

                return JSON.stringify(contents, null, 2);

              } catch (error) {
                console.error(`Failed to read files: ${error}`);
                return "Error:" + error;
              }
            })
          }
        })
      ],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssistantMessageText = lastAssistantTextMessageContent(result);

          if (lastAssistantMessageText && network) {
            if (lastAssistantMessageText.includes("<task_summary>")) {
              network.state.data.summary = lastAssistantMessageText;
            }
          }

          return result;
        }
      }
    });

    const network = createNetwork({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      router: async ({ network }) => {
        const summary = network.state.data.summary;

        if (summary) {
          return;
        }

        return codeAgent;
      }
    })

    const result = await network.run(event.data.text)

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    return { 
      url: sandboxUrl,
      title: "Fragment",
      files: result.state.data.files || {},
      summary: result.state.data.summary || "No summary available.",
    };
  },
);