import { prisma } from "@/lib/db";
import { inngest } from "@/inngest/client";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

// Utility function to check if sandbox is still alive
async function checkSandboxHealth(sandboxUrl: string): Promise<boolean> {
  try {
    const response = await fetch(sandboxUrl, {
      method: "GET",
    });
    
    if (!(response.status === 502)) {
      return true; // Sandbox is alive
    } else {
      return false; // Sandbox is down
    }
  } catch (error) {
    console.error("Error checking sandbox health:", error);
    return false;
  }
}

// fragments-router.ts
export const fragmentsRouter = createTRPCRouter({
  checkSandboxValidity: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ input }) => {
      const fragment = await prisma.fragment.findUnique({
        where: { id: input.id },
      });
      
      if (!fragment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fragment not found",
        });
      }

      // Check if current sandbox is still alive
      const isAlive = await checkSandboxHealth(fragment.sandboxUrl);
      
      if (isAlive) {
        return {
          url: fragment.sandboxUrl,
          status: 'ready' as const
        };
      }

      // Check if recreation is already in progress
      const isRecreating = await checkIfRecreationInProgress(input.id);
      
      if (!isRecreating) {
        // Trigger recreation
        await inngest.send({
          name: "sandbox/recreate",
          data: { fragmentId: input.id },
        });
        
        // Mark as recreating
        await markRecreationInProgress(input.id);
      }

      // Return status indicating recreation is in progress
      return {
        url: null,
        status: 'recreating' as const
      };
    }),

  // New endpoint to check recreation status
  getSandboxStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ input }) => {
      const fragment = await prisma.fragment.findUnique({
        where: { id: input.id },
      });
      
      if (!fragment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fragment not found",
        });
      }

      const isRecreating = await checkIfRecreationInProgress(input.id);
      
      if (isRecreating) {
        return {
          url: null,
          status: 'recreating' as const
        };
      }

      // Check if the URL is now valid
      const isAlive = await checkSandboxHealth(fragment.sandboxUrl);
      
      return {
        url: fragment.sandboxUrl,
        status: isAlive ? 'ready' as const : 'failed' as const
      };
    }),
});

// Helper functions (implement these based on your needs)
async function checkIfRecreationInProgress(fragmentId: string): Promise<boolean> {
  // Option 1: Check a database flag
  const fragment = await prisma.fragment.findUnique({
    where: { id: fragmentId },
    select: { isRecreating: true } // Add this field to your schema
  });
  return fragment?.isRecreating || false;

}

async function markRecreationInProgress(fragmentId: string): Promise<void> {
  // Option 1: Update database flag
  await prisma.fragment.update({
    where: { id: fragmentId },
    data: { isRecreating: true }
  });

}
