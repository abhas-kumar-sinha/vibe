import { prisma } from '@/lib/db';
import { inngest } from '@/inngest/client';
import { generateSlug } from 'random-word-slugs';
import { baseProcedure, createTRPCRouter } from '@/trpc/init';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const projectsRouter = createTRPCRouter({
    getOne: baseProcedure
        .input(z.object({
            id: z.string().min(1, { message: 'Project ID is required' }),
        }))
        .query(async ({ input }) => {
            const existingProject =  await prisma.project.findUnique({
                where: { id: input.id },
            });

            if (!existingProject) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
            }

            return existingProject;
        }),
    getMany: baseProcedure
        .query(async () => {
            return await prisma.project.findMany({
                orderBy: {
                    createdAt: 'desc',
                },
            });
        }),
    create: baseProcedure
        .input(
            z.object({
                value: z.string()
                .min(1, { message: 'Value cannot be empty' })
                .max(10000, { message: 'Value is too long' }),
            })
        )
        .mutation(async ({ input }) => {
            const createdProject = await prisma.project.create({
                data: {
                    name: generateSlug(2, { format: 'kebab' }),
                    messages: {
                        create: {
                            content: input.value,
                            role: "USER",
                            type: "RESULT",
                        }
                    }
                }
            })

            await inngest.send({
                name: 'code-agent/run',
                data: {
                    content: input.value,
                    projectId: createdProject.id,
                },
            });

            return createdProject;
        })
});