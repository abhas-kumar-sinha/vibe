// fragment-web.tsx
import { Fragment } from "@/generated/prisma";
import { useState, useEffect } from "react";
import { ExternalLinkIcon, RefreshCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/hints";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";

interface Props {
  data: Fragment;
}

const FragmentWeb = ({ data }: Props) => {
  const [fragmentKey, setFragmentKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const trpc = useTRPC();

  // Initial query to check sandbox validity
  const { data: initialSandboxData } = useSuspenseQuery(
    trpc.fragments.checkSandboxValidity.queryOptions({
      id: data.id
    })
  );

  // Start polling if initial check shows recreating
  useEffect(() => {
    if (initialSandboxData?.status === 'recreating') {
      setIsPolling(true);
    }
  }, [initialSandboxData?.status]);

  // Polling query that only runs if sandbox is being recreated
  const { data: sandboxStatus } = useQuery({
    ...trpc.fragments.getSandboxStatus.queryOptions({
      id: data.id
    }),
    enabled: isPolling,
    refetchInterval: 2000, // Poll every 2 seconds
    refetchIntervalInBackground: true,
  });

  // Stop polling when recreation is complete and force iframe refresh
  useEffect(() => {
    if (sandboxStatus && (sandboxStatus.status === 'ready' || sandboxStatus.status === 'failed')) {
      setIsPolling(false);
      // Force iframe refresh when new URL is ready
      if (sandboxStatus.status === 'ready' && sandboxStatus.url) {
        setFragmentKey((prev) => prev + 1);
      }
    }
  }, [sandboxStatus]);

  // Determine current sandbox state
  const currentSandboxData = sandboxStatus || initialSandboxData;
  const sandboxUrl = currentSandboxData?.url;
  const isRecreating = currentSandboxData?.status === 'recreating';

  const onRefresh = () => {
    setFragmentKey((prev) => prev + 1);
  };

  const handleCopy = () => {
    if (sandboxUrl) {
      navigator.clipboard.writeText(sandboxUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Show loading state while recreating
  if (isRecreating) {
    return (
      <div className="flex flex-col w-full h-full">
        <div className="p-2 border-b bg-sidebar flex items-center gap-x-2">
          <Button size="sm" variant="outline" disabled>
            <RefreshCcwIcon className="animate-spin" />
          </Button>
          <div className="flex-1 text-sm text-muted-foreground">
            Creating new sandbox environment...
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground">Loading preview...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full">
      <div className="p-2 border-b bg-sidebar flex items-center gap-x-2">
        <Hint text="Refresh" side="bottom" align="start">
          <Button size="sm" variant="outline" onClick={onRefresh}>
            <RefreshCcwIcon />
          </Button>
        </Hint>

        <Hint text="Click to copy" side="bottom">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="flex-1 justify-start text-start font-normal"
            disabled={!sandboxUrl || copied}
          >
            <span className="truncate">
              {sandboxUrl || "No URL available"}
            </span>
          </Button>
        </Hint>

        <Hint text="Open in a new tab" side="bottom" align="start">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (sandboxUrl) {
                window.open(sandboxUrl, "_blank");
              }
            }}
            disabled={!sandboxUrl}
          >
            <ExternalLinkIcon />
          </Button>
        </Hint>
      </div>
      
      {sandboxUrl ? (
        <iframe
          key={fragmentKey}
          className="h-full w-full"
          sandbox="allow-forms allow-scripts allow-same-origin"
          loading="lazy"
          src={sandboxUrl}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Sandbox not available
          </p>
        </div>
      )}
    </div>
  );
};

export default FragmentWeb;