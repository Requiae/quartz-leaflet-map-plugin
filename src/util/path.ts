export type SlugLike<T> = string & { __brand: T };
export type FilePath = SlugLike<"filepath">;
export type FullSlug = SlugLike<"full">;
export type SimpleSlug = SlugLike<"simple">;
export type RelativeURL = SlugLike<"relative">;

export interface TransformOptions {
    strategy: "absolute" | "relative" | "shortest";
    allSlugs: FullSlug[];
}
export function transformLink(
    _src: FullSlug,
    _target: string,
    _opts: TransformOptions,
): RelativeURL {
    return "" as RelativeURL;
}

export function resolveRelative(_current: FullSlug, _target: FullSlug | SimpleSlug): RelativeURL {
    return "" as RelativeURL;
}
