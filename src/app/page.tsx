"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

const Page = () => {
  const trpc = useTRPC();
  const invoke = useMutation(trpc.invoke.mutationOptions({}));

  return (
    <Button onClick={() => invoke.mutate({ text: "create a button component." })} >
      Invoke background job
    </Button>
  )
}
export default Page