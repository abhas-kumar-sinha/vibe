import { Sandbox } from "@e2b/code-interpreter";
import { inngest } from "./client";
import {
  gemini,
  createAgent,
  createTool,
  createNetwork,
  type Tool,
  type Message,
  createState,
} from "@inngest/agent-kit";
import { getSandbox, lastAssistantTextMessageContent } from "./utils";
import { z } from "zod";
import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "@/prompts";
import { prisma } from "@/lib/db";

interface AgentState {
  summary: string;
  files: { [path: string]: string };
}

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("vibe-nextjs-base-template-scn-123");
      await sandbox.setTimeout(60_000 * 10);
      return sandbox.sandboxId;
    });

    const getAllFiles = await step.run("get-all-files", async () => {
      const sandbox = await getSandbox(sandboxId);
      const result: { [path: string]: string } = {};

      // Directories/files to skip
      const skipDirs = new Set([
        ".git",
        "node_modules",
        ".next",
        "dist",
        "build",
        "prisma",
        "generated",
        "nextjs-app",
        "ui",
      ]);
      const skipFiles = new Set([
        ".DS_Store",
        "Thumbs.db",
        "favicon.ico",
        ".bash_logout",
        ".bashrc",
        ".profile",
        ".wh.nextjs-app",
        "package-lock.json",
      ]);

      async function getAllFilesRecursive(dirPath: string) {
        const entries = await sandbox.files.list(dirPath);

        for (const entry of entries) {
          const fullPath =
            dirPath === "." ? entry.name : `${dirPath}/${entry.name}`;

          // Skip unwanted directories and files
          if (skipDirs.has(entry.name) || skipFiles.has(entry.name)) {
            continue;
          }

          if (entry.type === "file") {
            try {
              const content = await sandbox.files.read(fullPath);
              result[fullPath] = content;
            } catch (error) {
              console.warn(`Could not read file ${fullPath}:`, error);
            }
          } else if (entry.type === "dir") {
            await getAllFilesRecursive(fullPath);
          }
        }
      }

      await getAllFilesRecursive(".");
      return result;
    });

    const previousMessages = await step.run(
      "get-previous-messages",
      async () => {
        const formattedMessages: Message[] = [];

        const messages = await prisma.message.findMany({
          where: {
            projectId: event.data.projectId,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 3,
        });

        for (const message of messages) {
          formattedMessages.push({
            type: "text",
            role: message.role === "ASSISTANT" ? "assistant" : "user",
            content: message.content,
          });
        }

        return formattedMessages.reverse();
      },
    );

    const state = createState<AgentState>(
      {
        summary: "",
        files: {},
      },
      {
        messages: previousMessages,
      },
    );

    const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description:
        "An expert coding agent that can write code, run commands, and manage files in a sandbox environment.",
      system: PROMPT,
      model: gemini({ model: "gemini-2.5-pro" }),
      tools: [
        createTool({
          name: "terminal",
          description:
            "Use the terminal to run commands in the sandbox environment.",
          parameters: z.object({
            command: z.string().describe("The command to run in the terminal."),
          }),
          handler: async ({ command }, { step }) => {
            return await step?.run("terminal", async () => {
              const buffers = { stdout: "", stderr: "" };

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
                return result.stdout;
              } catch (error) {
                console.error(
                  `Command failed: ${error} \nstdout: ${buffers.stdout} \nstderr: ${buffers.stderr}`,
                );

                return `Command failed: ${error} \nstdout: ${buffers.stdout} \nstderr: ${buffers.stderr}`;
              }
            });
          },
        }),
        createTool({
          name: "createOrUpdateFile",
          description: "Create or update a file in the sandbox environment.",
          parameters: z.object({
            files: z.array(
              z.object({
                path: z
                  .string()
                  .describe("The path of the file to create or update."),
                content: z
                  .string()
                  .describe("The content of the file to create or update."),
              }),
            ),
          }),
          handler: async (
            { files },
            { step, network }: Tool.Options<AgentState>,
          ) => {
            const newFiles = await step?.run(
              "createOrUpdateFiles",
              async () => {
                try {
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
              },
            );
            if (typeof newFiles === "object") {
              network.state.data.files = newFiles;
            }
          },
        }),
        createTool({
          name: "readFiles",
          description: "Read files from the sandbox environment.",
          parameters: z.object({
            paths: z.array(
              z.string().describe("The paths of the files to read."),
            ),
          }),
          handler: async ({ paths }, { step }) => {
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
            });
          },
        }),
      ],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssistantMessageText =
            lastAssistantTextMessageContent(result);

          if (lastAssistantMessageText && network) {
            if (lastAssistantMessageText.includes("<task_summary>")) {
              network.state.data.summary = lastAssistantMessageText;
            }
          }

          return result;
        },
      },
    });

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      defaultState: state,
      router: async ({ network }) => {
        const summary = network.state.data.summary;

        if (summary) {
          return;
        }

        return codeAgent;
      },
    });

    const result = await network.run(event.data.content, { state });

    const fragmentTitleGenerator = createAgent({
      name: "fragment-title-generator",
      description: "A Fragment Title generator",
      system: FRAGMENT_TITLE_PROMPT,
      model: gemini({
        model: "gemini-2.0-flash",
      }),
    });

    const responseGenerator = createAgent({
      name: "response-generator",
      description: "A response generator",
      system: RESPONSE_PROMPT,
      model: gemini({
        model: "gemini-2.0-flash",
      }),
    });

    const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(
      result.state.data.summary,
    );
    const { output: responseOutput } = await responseGenerator.run(
      result.state.data.summary,
    );

    const generateFragmentTitle = () => {
      if (fragmentTitleOutput[0].type !== "text") {
        return "Fragment";
      }

      if (Array.isArray(fragmentTitleOutput[0].content)) {
        return fragmentTitleOutput[0].content.map((txt) => txt).join("");
      } else {
        return fragmentTitleOutput[0].content;
      }
    };

    const generateResponse = () => {
      if (responseOutput[0].type !== "text") {
        return "Here you go";
      }

      if (Array.isArray(responseOutput[0].content)) {
        return responseOutput[0].content.map((txt) => txt).join("");
      } else {
        return responseOutput[0].content;
      }
    };

    const isError =
      !result.state.data.summary ||
      Object.keys(result.state.data.files || {}).length === 0;

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    await step.run("save-result", async () => {
      if (isError) {
        return await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something went wrong. Please try again.",
            role: "ASSISTANT",
            type: "ERROR",
          },
        });
      }

      const existingFiles = result.state.data.files || {};
      const mergedFiles = { ...existingFiles, ...getAllFiles };

      return await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: generateResponse(),
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create: {
              sandboxUrl: sandboxUrl,
              title: generateFragmentTitle(),
              files: mergedFiles,
            },
          },
        },
      });
    });

    return {
      url: sandboxUrl,
      title: "Fragment",
      files: result.state.data.files || {},
      summary: result.state.data.summary || "No summary available.",
    };
  },
);
