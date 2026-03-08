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

