import 'next';

declare module 'next' {
  export type {
    Metadata,
    MetadataRoute,
    ResolvingMetadata,
    ResolvedMetadata,
    Viewport,
    ResolvingViewport,
    ResolvedViewport,
  } from 'next/dist/lib/metadata/types/metadata-interface';
}
