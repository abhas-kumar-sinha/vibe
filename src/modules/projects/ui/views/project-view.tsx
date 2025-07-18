"use client";

import MessagesContainer from "../components/message-container";

import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Suspense } from "react";

interface Props {
    projectId: string;
}

const ProjectView = ({ projectId }: Props) => {

    return (
        <div className="h-screen">
            <ResizablePanelGroup direction="horizontal">
                <ResizablePanel
                    defaultSize={28}
                    minSize={28}
                    className="flex flex-col min-h-0 gap-2 pr-3 pl-2">
                    <Suspense fallback={<div>Loading project...</div>}>
                        <MessagesContainer projectId={projectId} />
                    </Suspense>
                </ResizablePanel>
                <ResizableHandle withHandle className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-400" />
                <ResizablePanel
                    defaultSize={72}
                    minSize={31}>
                    TODO: preview
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    )
}
export default ProjectView