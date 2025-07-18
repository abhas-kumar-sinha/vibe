import { prisma } from '@/lib/db';
import { inngest } from '@/inngest/client';
import { baseProcedure, createTRPCRouter } from '@/trpc/init';
import { z } from 'zod';

export const messagesRouter = createTRPCRouter({
    getMany: baseProcedure
        .query(async () => {
            return await prisma.message.findMany({
                orderBy: {
                    createdAt: 'desc',
                },
                include: {
                    fragment: true,
                }
            });
        }),
    create: baseProcedure
        .input(
            z.object({
                value: z.string().min(1, { message: 'Message cannot be empty' }),
            })
        )
        .mutation(async ({ input }) => {
            const createdMessage = await prisma.message.create({
                data: {
                    content: input.value,
                    role: "USER",
                    type: "RESULT",
                }
            })

            await inngest.send({
                name: 'code-agent/run',
                data: {
                    content: input.value,
                },
            });

            return createdMessage;
        })
});