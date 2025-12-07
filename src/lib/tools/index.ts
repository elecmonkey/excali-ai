// Export all tools for the Excalidraw AI Agent
export { 
  createDiagramFromMermaid, 
  replaceDiagramWithMermaid,
  mermaidTools 
} from "./mermaid-tools";

// Combined tools object for registration in API route
import { mermaidTools } from "./mermaid-tools";

export const allTools = {
  ...mermaidTools,
};
