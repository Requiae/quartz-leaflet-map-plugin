export declare global {
    interface Window {
        addCleanup(fn: (...args: unknown[]) => void);
    }

    interface ControlOptions {
        enableCopyTool: boolean;
    }
}
