declare module 'react-dom/client' {
  import { Root, HydrationOptions, ReactElement } from 'react';
  
  interface CreateRootOptions {
    hydrate?: boolean;
    hydrationOptions?: HydrationOptions;
  }
  
  function createRoot(
    container: Element | DocumentFragment,
    options?: CreateRootOptions
  ): Root;
  
  function hydrateRoot(
    container: Element | DocumentFragment,
    initialChildren: ReactElement,
    options?: HydrationOptions
  ): Root;
}
