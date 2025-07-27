import { Sandbox } from "@e2b/code-interpreter";
import { AgentResult, TextMessage } from "@inngest/agent-kit";

export async function getSandbox(sandboxId: string) {
  const sandbox = await Sandbox.connect(sandboxId);
  await sandbox.setTimeout(60_000 * 10);
  return sandbox;
}

export function lastAssistantTextMessageContent(result: AgentResult) {
  const lastAssistantTextMessageIndex = result.output.findLastIndex(
    (message) => message.role === "assistant",
  );

  const message = result.output[lastAssistantTextMessageIndex] as
    | TextMessage
    | undefined;

  return message?.content
    ? typeof message.content === "string"
      ? message.content
      : message.content.map((c) => c.text).join("")
    : undefined;
}

// const getAllFiles = await step.run("get-all-files", async () => {
//   const sandbox = await getSandbox(sandboxId);
//   const result: { [path: string]: string } = {};

//   // Directories/files to skip
//   const skipDirs = new Set([
//     ".git",
//     "node_modules",
//     ".next",
//     "dist",
//     "build",
//     "prisma",
//     "generated",
//     "nextjs-app",
//   ]);
//   const skipFiles = new Set([
//     ".DS_Store",
//     "Thumbs.db",
//     "favicon.ico",
//     ".bash_logout",
//     ".bashrc",
//     ".profile",
//     ".wh.nextjs-app",
//     "package-lock.json",
//   ]);

//   async function getAllFilesRecursive(dirPath: string) {
//     const entries = await sandbox.files.list(dirPath);

//     for (const entry of entries) {
//       const fullPath =
//         dirPath === "." ? entry.name : `${dirPath}/${entry.name}`;

//       // Skip unwanted directories and files
//       if (skipDirs.has(entry.name) || skipFiles.has(entry.name)) {
//         continue;
//       }

//       if (entry.type === "file") {
//         try {
//           const content = await sandbox.files.read(fullPath);
//           result[fullPath] = content;
//         } catch (error) {
//           console.warn(`Could not read file ${fullPath}:`, error);
//         }
//       } else if (entry.type === "dir") {
//         await getAllFilesRecursive(fullPath);
//       }
//     }
//   }

//   await getAllFilesRecursive(".");
//   return result;
// });
