import { Sandbox } from "@e2b/code-interpreter";
import { inngest } from "./client";
import { gemini, createAgent } from "@inngest/agent-kit";
import { getSandbox } from "./utils";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {

    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("vibe-nextjs-base-template-scn-123");
      return sandbox.sandboxId;
    });

    const summarizer = createAgent({
      name: "summarizer",
      system: "You are an expert Nextjs developer. You generate code that runs in a sandbox environment.",
      model: gemini({ model: "gemini-2.0-flash" }),
    });

    const { output } = await summarizer.run(`make: ${event.data.text}`);

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    return { output, sandboxUrl };
  },
);