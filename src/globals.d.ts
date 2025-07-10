export declare global {
  interface Document {
    addEventListener<K extends keyof CustomEventMap>(
      type: K,
      listener: (this: Document, ev: CustomEventMap[K]) => void,
    ): void;
    removeEventListener<K extends keyof CustomEventMap>(
      type: K,
      listener: (this: Document, ev: CustomEventMap[K]) => void,
    ): void;
    dispatchEvent<K extends keyof CustomEventMap>(ev: CustomEventMap[K] | UIEvent): void;
  }
  interface Window {
    spaNavigate(url: URL, isBack: boolean = false);
    addCleanup(fn: (...args: any[]) => void);
  }
}

// VFile overwrites copied from Quartz
export declare module "vfile" {
  type SlugLike<T> = string & { __brand: T };
  type FilePath = SlugLike<"filepath">;
  type FullSlug = SlugLike<"full">;

  interface DataMap {
    slug: FullSlug;
    filePath: FilePath;
    relativePath: FilePath;
  }

  interface DataMap {
    aliases: FullSlug[];
    frontmatter: { [key: string]: unknown } & {
      title: string;
    } & Partial<{
        tags: string[];
        aliases: string[];
        modified: string;
        created: string;
        published: string;
        description: string;
        socialDescription: string;
        publish: boolean | string;
        draft: boolean | string;
        lang: string;
        enableToc: string;
        cssclasses: string[];
        socialImage: string;
        comments: boolean | string;
      }>;
  }
}
