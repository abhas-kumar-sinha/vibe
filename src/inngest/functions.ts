import { Sandbox } from "@e2b/code-interpreter";
import { inngest } from "./client";
import { createVertex } from "@ai-sdk/google-vertex";
import { generateText } from "ai";
import { getSandbox } from "./utils";
import { z } from "zod";
import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "@/prompts";
import { prisma } from "@/lib/db";

interface AgentState {
  summary: string;
  files: { [path: string]: string };
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
}

interface ToolResult {
  success: boolean;
  result: string;
  error?: string;
}

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => {    
    const projectId = process.env.GOOGLE_VERTEX_PROJECT || process.env.GOOGLE_CLOUD_PROJECT_ID || "vibe-dev-467219";
    const location = process.env.GOOGLE_VERTEX_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

    const vertex = createVertex({
      project: projectId,
      location: location,
      // Authentication will be handled automatically by the SDK
      // if GOOGLE_APPLICATION_CREDENTIALS is set or if running on GCP
    });

    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("vibe-nextjs-base-template-scn-123");
      await sandbox.setTimeout(60_000 * 10);
      return sandbox.sandboxId;
    });

    const previousMessages = await step.run(
      "get-previous-messages",
      async () => {
        const formattedMessages: Array<{
          role: "user" | "assistant";
          content: string;
        }> = [];

        const messages = await prisma.message.findMany({
          where: {
            projectId: event.data.projectId,
          },
          include: {
            fragment: true,
          },
          orderBy: { createdAt: "desc" },
          take: 4,
        });

        for (const message of messages) {
          formattedMessages.push({
            role: message.role === "ASSISTANT" ? "assistant" : "user",
            content: message.content,
          });
        }

        const getFilesFromMessages = (messages: any) => {
          if (messages.length === 0) {
            return {};
          }
          for (const message of messages) {
            if (message.role === "ASSISTANT" && message.fragment) {
              return message.fragment.files || {};
            }
          }
          return {};
        };

        const files = getFilesFromMessages(messages);

        return { formattedMessages, files };
      }
    );

    // Initialize agent state
    const agentState: AgentState = {
      summary: "",
      files: (previousMessages.files as { [path: string]: string }) || {},
      messages: [
        { role: "system", content: PROMPT },
        ...previousMessages.formattedMessages.reverse(), // Reverse to get chronological order
        { role: "user", content: event.data.content },
      ],
    };

    // Tool implementations
    const runTerminalCommand = async (command: string): Promise<ToolResult> => {
      const buffers = { stdout: "", stderr: "" };

      try {
        const sandbox = await getSandbox(sandboxId);
        
        // Add timeout and better error handling
        const result = await Promise.race([
          sandbox.commands.run(command, {
            onStdout: (data: string) => {
              buffers.stdout += data;
            },
            onStderr: (data: string) => {
              buffers.stderr += data;
            },
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Command timeout after 30 seconds")), 30000)
          )
        ]) as any;
        
        const output = result.stdout || buffers.stdout || "Command completed successfully";
        const errors = result.stderr || buffers.stderr;
        
        // Consider command successful if exit code is 0, even with stderr
        const isSuccess = result.exitCode === 0;
        
        return {
          success: isSuccess,
          result: `Exit code: ${result.exitCode}\nOutput: ${output}${errors ? `\nErrors: ${errors}` : ''}`,
        };
      } catch (error) {
        const errorMessage = `Command failed: ${error}\nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`;
        return {
          success: false,
          result: errorMessage,
          error: errorMessage,
        };
      }
    };

    const createOrUpdateFiles = async (
      files: Array<{ path: string; content: string }>
    ): Promise<ToolResult> => {
      try {
        const sandbox = await getSandbox(sandboxId);
        const updatedFiles = { ...agentState.files };
        const results = [];
        const errors = [];

        for (const file of files) {
          try {            
            // Ensure directory exists
            const dir = file.path.split('/').slice(0, -1).join('/');
            if (dir && dir !== '.') {
              try {
                await sandbox.commands.run(`mkdir -p "${dir}"`);
              } catch (dirError) {
                console.log(`⚠️ Directory creation warning for ${dir}:`, dirError);
              }
            }
            
            await sandbox.files.write(file.path, file.content);
            updatedFiles[file.path] = file.content;
            results.push(file.path);

            
          } catch (fileError) {
            const errorMsg = fileError instanceof Error ? fileError.message : String(fileError);
            errors.push({ path: file.path, error: errorMsg });
          }
        }

        // Update agent state with successfully created files
        agentState.files = updatedFiles;

        if (results.length === 0 && errors.length > 0) {
          const errorMessage = `No files could be created. Errors: ${errors.map(e => `${e.path}: ${e.error}`).join(', ')}`;
          return {
            success: false,
            result: errorMessage,
            error: errorMessage,
          };
        }

        let summary = `Successfully created/updated ${results.length} file(s): ${results.join(", ")}`;
        if (errors.length > 0) {
          summary += `. Failed to create ${errors.length} file(s): ${errors.map(e => e.path).join(", ")}`;
        }

        return {
          success: results.length > 0,
          result: summary,
        };
      } catch (error) {
        const errorMessage = `Failed to create or update files: ${error}`;
        return {
          success: false,
          result: errorMessage,
          error: errorMessage,
        };
      }
    };

    const readFiles = async (paths: string[]): Promise<ToolResult> => {
      try {
        const sandbox = await getSandbox(sandboxId);
        const contents = [];
        const errors = [];

        for (const path of paths) {
          try {
            const content = await sandbox.files.read(path);
            contents.push({ path, content });
          } catch (fileError) {
            const errorMsg = fileError instanceof Error ? fileError.message : String(fileError);
            errors.push({ path, error: errorMsg });

          }
        }

        if (contents.length === 0 && errors.length > 0) {
          const errorMessage = `No files could be read. Errors: ${errors.map(e => `${e.path}: ${e.error}`).join(', ')}`;
          return {
            success: false,
            result: errorMessage,
            error: errorMessage,
          };
        }

        const result = {
          successful_reads: contents,
          failed_reads: errors,
          summary: `Successfully read ${contents.length} files, failed to read ${errors.length} files`
        };

        return {
          success: contents.length > 0,
          result: JSON.stringify(result, null, 2),
        };
      } catch (error) {
        const errorMessage = `Failed to read files: ${error}`;
        return {
          success: false,
          result: errorMessage,
          error: errorMessage,
        };
      }
    };

    // Test Vertex AI connection with available models
    const testVertexAI = async () => {
      try {        
        const modelsToTest = [
          "gemini-2.5-pro"
        ];
        
        for (const modelName of modelsToTest) {
          try {
            await generateText({
              model: vertex(modelName),
              messages: [{ role: "user", content: "Reply with just 'OK'" }],
              maxTokens: 10,
              temperature: 0,
            });
            return { working: true, model: modelName };
          } catch (modelError) {
            const errorMsg = modelError instanceof Error ? modelError.message : String(modelError);
            
            // Check for common authentication and permission errors
            if (errorMsg.includes("403") || errorMsg.includes("Permission") || errorMsg.includes("aiplatform.endpoints.predict")) {
              console.error("🚫 PERMISSION ERROR: Make sure your service account has the 'Vertex AI User' role");
              console.error("🚫 Required permission: aiplatform.endpoints.predict");
            }
            if (errorMsg.includes("Unable to authenticate")) {
              console.error("🚫 AUTH ERROR: Check GOOGLE_APPLICATION_CREDENTIALS environment variable");
            }
            
            continue;
          }
        }
        
        throw new Error("All model tests failed - check authentication and permissions");
      } catch (error) {
        return { working: false, model: null };
      }
    };

    const vertexTest = await step.run("test-vertex-ai", testVertexAI);

    if (!vertexTest.working || !vertexTest.model) {
      return {
        url: "",
        title: "Error: Vertex AI Connection Failed",
        files: {},
        summary: "Vertex AI connection failed. Please check:\n1. GOOGLE_APPLICATION_CREDENTIALS is set\n2. Service account has 'Vertex AI User' role\n3. Project and location are correct",
      };
    }

    // Main conversation loop with tool calling
    const result = await step.run("run-agent-conversation", async () => {
      const maxIterations = 10;
      let currentIteration = 0;
      let conversationComplete = false;

      while (currentIteration < maxIterations && !conversationComplete) {
        try {
          
          const response = await generateText({
            model: vertex(vertexTest.model),
            messages: agentState.messages,
            tools: {
              terminal: {
                description: "Use the terminal to run commands in the sandbox environment.",
                parameters: z.object({
                  command: z.string().describe("The command to run in the terminal."),
                }),
                execute: async ({ command }) => {
                  return await runTerminalCommand(command);
                },
              },
              createOrUpdateFile: {
                description: "Create or update files in the sandbox environment.",
                parameters: z.object({
                  files: z.array(
                    z.object({
                      path: z.string().describe("The path of the file to create or update."),
                      content: z.string().describe("The content of the file to create or update."),
                    })
                  ),
                }),
                execute: async ({ files }) => {
                  return await createOrUpdateFiles(files);
                },
              },
              listFiles: {
                description: "List files and directories in the sandbox environment to understand the project structure.",
                parameters: z.object({
                  path: z.string().optional().describe("The path to list (defaults to current directory)"),
                  recursive: z.boolean().optional().describe("Whether to list files recursively"),
                }),
                execute: async ({ path = ".", recursive = false }) => {
                  try {
                    const sandbox = await getSandbox(sandboxId);
                    const command = recursive ? `find "${path}" -type f -name "*" | head -50` : `ls -la "${path}"`;
                    const result = await sandbox.commands.run(command);
                    return {
                      success: true,
                      result: `Files in ${path}:\n${result.stdout || "No files found"}`,
                    };
                  } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    return {
                      success: false,
                      result: `Failed to list files: ${errorMsg}`,
                      error: errorMsg,
                    };
                  }
                },
              },
              readFiles: {
                description: "Read files from the sandbox environment.",
                parameters: z.object({
                  paths: z.array(z.string().describe("The paths of the files to read.")),
                }),
                execute: async ({ paths }) => {
                  return await readFiles(paths);
                },
              },
            },
            maxSteps: 10,
          });

          // Only add assistant response if it has content
          if (response.text && response.text.trim().length > 0) {
            agentState.messages.push({
              role: "assistant",
              content: response.text,
            });

            // Check if task is complete (contains summary)
            if (response.text.includes("<task_summary>")) {
              agentState.summary = response.text;
              conversationComplete = true;
              break;
            }
          }

          // Check if we should request a summary
          const hasToolCalls = response.toolCalls && response.toolCalls.length > 0;
          
          if (!hasToolCalls && (!response.text || response.text.trim().length === 0)) {
            agentState.messages.push({
              role: "user",
              content: "Please provide a summary of what you've accomplished wrapped in <task_summary> tags. Include details about the files you created and what functionality was implemented.",
            });
          } else if (!hasToolCalls && response.text && response.text.trim().length > 0 && !response.text.includes("<task_summary>")) {
            agentState.messages.push({
              role: "user",
              content: "Please provide a summary of what you've accomplished wrapped in <task_summary> tags. Include details about the files you created and what functionality was implemented.",
            });
          }

          currentIteration++;

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          
          // If we have files created, still consider it partially successful
          if (Object.keys(agentState.files).length > 0) {
            agentState.summary = `<task_summary>
              Task partially completed with ${Object.keys(agentState.files).length} files created: ${Object.keys(agentState.files).join(", ")}
              Error encountered: ${errorMsg}
              </task_summary>`;
            conversationComplete = true;
          }
          break;
        }
      }

      // Final fallback if no summary was generated but files exist
      if (!conversationComplete && Object.keys(agentState.files).length > 0) {
        agentState.summary = `<task_summary>
Task completed with ${Object.keys(agentState.files).length} files created: ${Object.keys(agentState.files).join(", ")}
Agent completed the work but did not provide a detailed summary.
</task_summary>`;
        conversationComplete = true;
      }

      // If still no summary and no files, create a minimal error summary
      if (!conversationComplete && agentState.summary.trim() === "") {
        agentState.summary = `<task_summary>
Task could not be completed. No files were created and no meaningful progress was made.
Please try rephrasing your request or check if the task is feasible.
</task_summary>`;
      }

      return {
        success: conversationComplete || Object.keys(agentState.files).length > 0,
        summary: agentState.summary,
        files: agentState.files,
        messages: agentState.messages,
      };
    });

    // Helper function to get fast model for auxiliary tasks
    const getFastModel = (currentModel: string): string => {
      if (currentModel.includes("flash")) {
        return currentModel;
      }
      // Try to use flash variant for faster auxiliary tasks
      return "gemini-2.5-pro";
    };

    // Generate fragment title using a fast model
    const fragmentTitle = await step.run("generate-fragment-title", async () => {
      try {
        if (!result.summary || result.summary.trim() === "") {
          return "Fragment";
        }
        
        const titleModel = getFastModel(vertexTest.model);
        
        const titleResponse = await generateText({
          model: vertex(titleModel),
          messages: [
            { role: "system", content: FRAGMENT_TITLE_PROMPT },
            { role: "user", content: result.summary },
          ],
          maxTokens: 100,
        });

        return titleResponse.text || "Fragment";
      } catch (error) {
        console.error("Error generating fragment title:", error);
        return "Fragment";
      }
    });

    // Generate user response using a fast model
    const userResponse = await step.run("generate-user-response", async () => {
      try {
        if (!result.summary || result.summary.trim() === "") {
          return "I encountered an issue completing the task. Please try again.";
        }
        
        const responseModel = getFastModel(vertexTest.model);
        
        const responseText = await generateText({
          model: vertex(responseModel),
          messages: [
            { role: "system", content: RESPONSE_PROMPT },
            { role: "user", content: result.summary },
          ],
          maxTokens: 200,
        });

        return responseText.text || "Here you go";
      } catch (error) {
        console.error("Error generating user response:", error);
        return "Here you go";
      }
    });

    const isError = !result.summary || (result.summary.trim() === "" && Object.keys(result.files || {}).length === 0);

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      const url = `https://${host}`;
      return url;
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

      return await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: userResponse,
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create: {
              sandboxUrl: sandboxUrl,
              title: fragmentTitle,
              files: result.files || {},
              sandboxConfig: {
                template: "vibe-nextjs-base-template-scn-123",
                timeout: 60_000 * 10,
                createdAt: new Date(),
                model: vertexTest.model, // Track which model was used
              },
            },
          },
        },
      });
    });

    const finalResult = {
      url: sandboxUrl,
      title: fragmentTitle,
      files: result.files || {},
      summary: result.summary || "No summary available.",
      modelUsed: vertexTest.model, // Include model info in response
    };

    return finalResult;
  }
);

export const recreateSandboxFunction = inngest.createFunction(
  { id: "recreate-sandbox" },
  { event: "sandbox/recreate" },
  async ({ event, step }) => {
    const { fragmentId } = event.data;

    try {
      // Get the fragment with stored files
      const fragment = await step.run("get-fragment", async () => {
        return await prisma.fragment.findUnique({
          where: { id: fragmentId },
        });
      });

      if (!fragment) {
        throw new Error("Fragment not found");
      }

      // Create new sandbox
      const sandboxId = await step.run("create-new-sandbox", async () => {
        const sandbox = await Sandbox.create("vibe-nextjs-base-template-scn-123");
        await sandbox.setTimeout(60_000 * 10);
        return sandbox.sandboxId;
      });

      const updatedFiles: { [path: string]: string } = {};

      // Recreate all files
      await step.run("recreate-files", async () => {
        const sandbox = await getSandbox(sandboxId);
        const files = fragment.files as { [path: string]: string };
        for (const [path, content] of Object.entries(files)) {
          await sandbox.files.write(path, content);
          updatedFiles[path] = content;
        }
        return updatedFiles;
      });

      // Get new sandbox URL
      const newSandboxUrl = await step.run("get-new-sandbox-url", async () => {
        const sandbox = await getSandbox(sandboxId);
        const host = sandbox.getHost(3000);
        return `https://${host}`;
      });

      // Update fragment with new URL and clear recreation flag
      await step.run("update-fragment", async () => {
        return await prisma.fragment.update({
          where: { id: fragmentId },
          data: {
            sandboxUrl: newSandboxUrl,
            isRecreating: false, // Clear the recreation flag
            updatedAt: new Date(),
          },
        });
      });

      return { url: newSandboxUrl };
    } catch (error) {
      // Clear recreation flag on error
      await step.run("clear-recreation-flag-on-error", async () => {
        await prisma.fragment.update({
          where: { id: fragmentId },
          data: {
            isRecreating: false,
          },
        });
      });
      throw error;
    }
  },
);
