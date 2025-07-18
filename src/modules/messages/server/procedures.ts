import { prisma } from '@/lib/db';
import { inngest } from '@/inngest/client';
import { baseProcedure, createTRPCRouter } from '@/trpc/init';
import { z } from 'zod';

export const messagesRouter = createTRPCRouter({
    getMany: baseProcedure
        .input(
            z.object({
                projectId: z.string().min(1, { message: 'Project Id is required' }),
            
            })
        )
        .query(async ({ input }) => {
            return await prisma.message.findMany({
                where: {
                    projectId: input.projectId,
                },
                orderBy: {
                    createdAt: 'asc',
                },
                include: {
                    fragment: true,
                }
            });
        }),
    create: baseProcedure
        .input(
            z.object({
                value: z.string()
                    .min(1, { message: 'Message cannot be empty' })
                    .max(10000, { message: 'Message is too long' }),
                projectId: z.string().min(1, { message: 'Project Id is required' }),
            
            })
        )
        .mutation(async ({ input }) => {
            const createdMessage = await prisma.message.create({
                data: {
                    projectId: input.projectId,
                    content: input.value,
                    role: "USER",
                    type: "RESULT",
                }
            })

            await inngest.send({
                name: 'code-agent/run',
                data: {
                    content: input.value,
                    projectId: input.projectId,
                },
            });

            return createdMessage;
        })
});