export type Direction = "up" | "down" | "horizontal" | "restorative" | "functional";
export type Response = "direct-response" | "gradual-response";
export type Structure = "single" | "protocol";
export type Temperature = "warming" | "cooling" | "neutral";

export interface VariationDimension {
  id: string;
  title: string;
  text: string;
}

export interface TechniqueDimensions {
  response?: Response;
  direction: Direction[];
  structure: Structure;
  temperature?: Temperature;
}

export interface Technique {
  id: string;
  title: string;
  text: string;
  howTo?: string[];
  dimensions: TechniqueDimensions;
  variationDimensions?: string[];
  children?: string[];
}

export interface BaseData {
  variationDimensions: VariationDimension[];
  techniques: Technique[];
}
