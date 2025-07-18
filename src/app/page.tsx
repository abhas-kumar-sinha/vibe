"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

const Page = () => {
  const router = useRouter();
  const trpc = useTRPC();
  const createProject = useMutation(trpc.projects.create.mutationOptions({
    onSuccess: (data) => {
      router.push(`/projects/${data.id}`);
    },
    onError: (error) => {
      console.error("Error creating project:", error);
    }
  }));

  return (
    <>
    <Button disabled={createProject.isPending} onClick={() => createProject.mutate({ value: "build a landing page with 2 sections." })} >
      Submit
    </Button>
    </>
  )
}
export default Page