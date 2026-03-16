export {};

declare global {
    interface Window {
        addCleanup(fn: () => void): void;
    }
}
