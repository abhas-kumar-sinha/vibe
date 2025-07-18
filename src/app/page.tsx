"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

const Page = () => {
  const trpc = useTRPC();
  const { data: messages } = useQuery(trpc.messages.getMany.queryOptions())
  const createMessage = useMutation(trpc.messages.create.mutationOptions({}));

  return (
    <>
    <Button disabled={createMessage.isPending} onClick={() => createMessage.mutate({ value: "build a basic landing page with 2 sections." })} >
      Invoke background job
    </Button>
    {JSON.stringify(messages, null, 2)}
    </>
  )
}
export default Page