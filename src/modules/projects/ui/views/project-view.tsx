"use client";

import MessagesContainer from "../components/message-container";
import { useState } from "react";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Suspense } from "react";
import { Fragment } from "@/generated/prisma";
import ProjectHeader from "../components/project-header";

interface Props {
    projectId: string;
}

const ProjectView = ({ projectId }: Props) => {

    const [activeFragment, setActiveFragment] = useState<Fragment | null>(null);

    return (
        <div className="h-screen">
            <ResizablePanelGroup direction="horizontal">
                <ResizablePanel
                    defaultSize={28}
                    minSize={28}
                    className="flex flex-col min-h-0 px-2">
                    <Suspense fallback={<div>Loading project...</div>}>
                        <ProjectHeader projectId={projectId} />
                    </Suspense>
                    <Suspense fallback={<div>Loading project...</div>}>
                        <MessagesContainer 
                        activeFragment={activeFragment}
                        setActiveFragment={setActiveFragment}
                        projectId={projectId} />
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