declare module "*.scss" {
  const content: string;
  export default content;
}

declare module "*.inline" {
  const content: string;
  export default content;
}

declare module "*.inline.ts" {
  const content: string;
  export default content;
}

declare global {
  interface Window {
    addCleanup(fn: () => void): void;
  }
}

declare module "@quartz-community/bases-page" {
  export interface BasesView {
    type: string;
    name?: string;
    limit?: number;
    [key: string]: unknown;
  }

  export interface BasesEntry {
    slug: string;
    title: string;
    properties: Record<string, unknown>;
  }

  export interface BasesData {
    views?: BasesView[];
    filters?: unknown;
  }

  export interface ViewRendererProps {
    entries: BasesEntry[];
    view: BasesView;
    basesData: BasesData;
    total: number;
    locale: string;
  }

  export type ViewRenderer = (props: ViewRendererProps) => import("preact").ComponentChild;

  export interface ViewTypeRegistration {
    id: string;
    name: string;
    icon?: string;
    render: ViewRenderer;
    css?: string;
    afterDOMLoaded?: string;
  }

  export const viewRegistry: {
    register: (registration: ViewTypeRegistration) => void;
  };
}
