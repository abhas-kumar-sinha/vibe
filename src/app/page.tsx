"use client";

import { useTRPC } from "@/trpc/client";

const Page = () => {
  const trpc = useTRPC();
  trpc.hello.queryOptions({ text: "Hello from TRPC!" });

  return (
    <div>page</div>
  )
}
export default Page