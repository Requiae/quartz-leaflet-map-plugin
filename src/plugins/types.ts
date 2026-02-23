import { PluggableList } from "unified";
import { BuildCtx } from "../util/ctx";

type JSResource = {
    loadTime: "beforeDOMReady" | "afterDOMReady";
    moduleType?: "module";
    spaPreserve?: boolean;
} & (
    | {
          src: string;
          contentType: "external";
      }
    | {
          script: string;
          contentType: "inline";
      }
);

type CSSResource = {
    content: string;
    inline?: boolean;
    spaPreserve?: boolean;
};

interface StaticResources {
    css: CSSResource[];
    js: JSResource[];
}

type OptionType = object | undefined;
type ExternalResourcesFn = (ctx: BuildCtx) => Partial<StaticResources> | undefined;
export type QuartzTransformerPlugin<Options extends OptionType = undefined> = (
    opts?: Options,
) => QuartzTransformerPluginInstance;
export type QuartzTransformerPluginInstance = {
    name: string;
    textTransform?: (ctx: BuildCtx, src: string) => string;
    markdownPlugins?: (ctx: BuildCtx) => PluggableList;
    htmlPlugins?: (ctx: BuildCtx) => PluggableList;
    externalResources?: ExternalResourcesFn;
};
