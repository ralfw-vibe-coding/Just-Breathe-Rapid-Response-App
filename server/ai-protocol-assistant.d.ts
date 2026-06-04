export function generateProtocolSuggestions(args: {
  clientDescription: string;
  overallDirectionHint?: string;
  phaseHints?: string[];
}): Promise<{
  suggestions: Array<{
    id: string;
    title: string;
    summary: string;
    rationale: string;
    overallDirection: string;
    phases: Array<{
      position: number;
      direction: string;
      techniqueId: string;
      variationDimensionId: string;
      variationA: string;
      variationB: string;
      variationC: string;
    }>;
  }>;
}>;
