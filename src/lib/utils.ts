import { type TreeItem } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert a record of files to a tree structure, with directories first.
 * @param files - Record of file paths to convert
 * @returns Tree structure for TreeView component
 *
 * @example
 * Input: { "src/Button.tsx": "...", "README.md": "..." }
 * Output: [["src", "Button.tsx"], "README.md"]
 */
export function convertFilesToTreeItems(files: {
  [path: string]: string;
}): TreeItem[] {
  interface TreeNode {
    [key: string]: TreeNode | null;
  }

  const tree: TreeNode = {};

  // Sort full paths alphabetically
  const sortedPaths = Object.keys(files).sort();

  // Build nested tree
  for (const filePath of sortedPaths) {
    const parts = filePath.split("/");
    let current = tree;

    // Traverse/create directory nodes
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part] as TreeNode;
    }

    // Attach file at the leaf
    current[parts[parts.length - 1]] = null;
  }

  // Recursive conversion: directories first, then files
  function convertNode(node: TreeNode): TreeItem[] {
    const entries = Object.entries(node);

    // Separate directories and files
    const dirEntries = entries
      .filter(([, value]) => value !== null)
      .sort(([a], [b]) => a.localeCompare(b));
    const fileEntries = entries
      .filter(([, value]) => value === null)
      .sort(([a], [b]) => a.localeCompare(b));

    const children: TreeItem[] = [];

    // Process directories first
    for (const [dirName, subtree] of dirEntries) {
      const subItems = convertNode(subtree as TreeNode);
      children.push([dirName, ...subItems]);
    }

    // Then process files
    for (const [fileName] of fileEntries) {
      children.push(fileName);
    }

    return children;
  }

  // Convert root and return
  return convertNode(tree);
}
