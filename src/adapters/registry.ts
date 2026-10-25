import type { IEventAdapter } from "../types";
import { FallClassicAdapter } from "./fall_classic";
import { NortheastClassicAdapter } from "./northeast_classic";

export function getAdapter(adapterType: string): IEventAdapter {
  switch (adapterType) {
    case "NortheastClassic":
      return new NortheastClassicAdapter();
    case "FallClassic":
      return new FallClassicAdapter();
    default:
      console.warn(`Unknown adapterType "${adapterType}", defaulting to NortheastClassic`);
      return new NortheastClassicAdapter();
  }
}
