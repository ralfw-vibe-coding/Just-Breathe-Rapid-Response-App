import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CircleX,
  ChevronDown,
  FileText,
  Search,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { BaseData, Direction, Technique, VariationDimension } from "@/types/base";

type BuilderColumn = {
  direction: Direction;
  techniqueId: string;
  variations: string[];
};

const DIRECTIONS: Direction[] = ["up", "down", "horizontal", "restorative", "functional"];
const DIRECTION_LABELS: Record<Direction, string> = {
  up: "Up",
  down: "Down",
  horizontal: "Balance",
  restorative: "Restorative",
  functional: "Functional",
};
const PRESET_PROTOCOLS: Record<Direction, string[]> = {
  up: ["e3j", "3cc"],
  down: ["pxc", "xlt"],
  horizontal: ["cts", "360-ipa"],
  restorative: ["3xv", "cap"],
  functional: [],
};

const DEFAULT_BUILDER: BuilderColumn[] = [
  { direction: "functional", techniqueId: "", variations: ["", "", ""] },
  { direction: "down", techniqueId: "", variations: ["", "", ""] },
  { direction: "horizontal", techniqueId: "", variations: ["", "", ""] },
];

function App() {
  const [base, setBase] = useState<BaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState<Direction | "all">("all");
  const [mobileTab, setMobileTab] = useState("base");
  const [openTechniqueId, setOpenTechniqueId] = useState<string | null>(null);
  const [overallDirection, setOverallDirection] = useState<Direction>("down");
  const [builder, setBuilder] = useState<BuilderColumn[]>(DEFAULT_BUILDER);

  useEffect(() => {
    async function loadBase() {
      try {
        const response = await fetch("/base/techniques.json");
        if (!response.ok) {
          throw new Error(`Failed to load techniques.json (${response.status})`);
        }

        const json = (await response.json()) as BaseData;
        setBase(json);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unknown loading error";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void loadBase();
  }, []);

  const allTechniques = base?.techniques ?? [];
  const techniquesById = Object.fromEntries(allTechniques.map((technique) => [technique.id, technique]));
  const variationById = Object.fromEntries((base?.variationDimensions ?? []).map((variation) => [variation.id, variation]));
  const singles = allTechniques.filter((technique) => technique.dimensions.structure === "single");

  const filteredTechniques = allTechniques
    .filter((technique) => {
      const directionMatches =
        directionFilter === "all" ? true : technique.dimensions.direction.includes(directionFilter);

      const textBlob = [
        technique.title,
        technique.text,
        technique.howTo?.join(" ") ?? "",
        technique.dimensions.response ?? "",
        technique.dimensions.structure,
        technique.dimensions.temperature ?? "",
        technique.dimensions.direction.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      const queryMatches = query.trim().length === 0 ? true : textBlob.includes(query.trim().toLowerCase());

      return directionMatches && queryMatches;
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  const suggestedProtocols = PRESET_PROTOCOLS[overallDirection]
    .map((id) => techniquesById[id])
    .filter((technique): technique is Technique => Boolean(technique));

  function updateColumn(index: number, next: Partial<BuilderColumn>) {
    setBuilder((current) =>
      current.map((column, columnIndex) => (columnIndex === index ? { ...column, ...next } : column)),
    );
  }

  function updateVariation(index: number, variationIndex: number, value: string) {
    setBuilder((current) =>
      current.map((column, columnIndex) => {
        if (columnIndex !== index) {
          return column;
        }

        return {
          ...column,
          variations: column.variations.map((variation, currentVariationIndex) =>
            currentVariationIndex === variationIndex ? value : variation,
          ),
        };
      }),
    );
  }

  function applyProtocol(protocol: Technique, mode: "full" | "directions") {
    const next = protocol.children?.slice(0, 3).map((childId) => {
      const child = techniquesById[childId];
      return {
        direction: (child?.dimensions.direction[0] ?? protocol.dimensions.direction[0] ?? "functional") as Direction,
        techniqueId: mode === "full" ? child?.id ?? "" : "",
        variations: ["", "", ""],
      };
    });

    if (!next || next.length !== 3) {
      return;
    }

    setBuilder(next);
    setMobileTab("builder");
  }

  function resetBuilder() {
    setBuilder(DEFAULT_BUILDER);
  }

  if (loading) {
    return <Shell><LoadingState /></Shell>;
  }

  if (error || !base) {
    return (
      <Shell>
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <CardTitle>JBR2 konnte die Base nicht laden.</CardTitle>
            <CardDescription>{error ?? "Unknown error"}</CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="space-y-5">
        <div className="space-y-3">
          <Badge className="w-fit" variant="accent">
            Just Breathe Rapid Response
          </Badge>
          <div>
            <h1 className="text-4xl font-[var(--font-display)] leading-none text-[color:var(--foreground)] sm:text-5xl">
              JBR2
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-[color:var(--muted-foreground)]">
              Custom breathwork protocols made easy
            </p>
          </div>
        </div>
      </header>

      <Tabs className="lg:hidden" value={mobileTab} onValueChange={setMobileTab}>
        <TabsList>
          <TabsTrigger value="base">Base</TabsTrigger>
          <TabsTrigger value="builder">Builder</TabsTrigger>
        </TabsList>
        <TabsContent value="base">
          <BasePanel
            techniques={filteredTechniques}
            openTechniqueId={openTechniqueId}
            onToggle={setOpenTechniqueId}
            query={query}
            onQueryChange={setQuery}
            directionFilter={directionFilter}
            onDirectionFilterChange={setDirectionFilter}
            techniquesById={techniquesById}
          />
        </TabsContent>
        <TabsContent value="builder">
          <BuilderPanel
            overallDirection={overallDirection}
            onOverallDirectionChange={setOverallDirection}
            suggestedProtocols={suggestedProtocols}
            techniquesById={techniquesById}
            builder={builder}
            singles={singles}
            variationById={variationById}
            onApplyProtocol={applyProtocol}
            onReset={resetBuilder}
            onUpdateColumn={updateColumn}
            onUpdateVariation={updateVariation}
          />
        </TabsContent>
      </Tabs>

      <div className="hidden gap-6 lg:grid lg:grid-cols-[360px_minmax(0,1fr)]">
        <BasePanel
          techniques={filteredTechniques}
          openTechniqueId={openTechniqueId}
          onToggle={setOpenTechniqueId}
          query={query}
          onQueryChange={setQuery}
          directionFilter={directionFilter}
          onDirectionFilterChange={setDirectionFilter}
          techniquesById={techniquesById}
        />

        <BuilderPanel
          overallDirection={overallDirection}
          onOverallDirectionChange={setOverallDirection}
          suggestedProtocols={suggestedProtocols}
          techniquesById={techniquesById}
          builder={builder}
          singles={singles}
          variationById={variationById}
          onApplyProtocol={applyProtocol}
          onReset={resetBuilder}
          onUpdateColumn={updateColumn}
          onUpdateVariation={updateVariation}
        />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10rem] top-[-8rem] h-[20rem] w-[20rem] rounded-full bg-[color:var(--glow-warm)] blur-3xl" />
        <div className="absolute right-[-6rem] top-[8rem] h-[18rem] w-[18rem] rounded-full bg-[color:var(--glow-cool)] blur-3xl" />
      </div>
      <main className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

function LoadingState() {
  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>Loading JBR2 Base</CardTitle>
        <CardDescription>Preparing techniques, protocols and variation dimensions.</CardDescription>
      </CardHeader>
    </Card>
  );
}

type BasePanelProps = {
  techniques: Technique[];
  openTechniqueId: string | null;
  onToggle: (id: string | null) => void;
  query: string;
  onQueryChange: (value: string) => void;
  directionFilter: Direction | "all";
  onDirectionFilterChange: (value: Direction | "all") => void;
  techniquesById: Record<string, Technique>;
};

function BasePanel({
  techniques,
  openTechniqueId,
  onToggle,
  query,
  onQueryChange,
  directionFilter,
  onDirectionFilterChange,
  techniquesById,
}: BasePanelProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 border-b border-[color:var(--border)] bg-[color:var(--panel)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-2xl">Base</CardTitle>
            <CardDescription>Browse all techniques and protocols.</CardDescription>
          </div>
          <Badge variant="outline">{techniques.length}</Badge>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
          <Input
            className="pl-11 pr-11"
            placeholder="Search techniques, protocols, dimensions..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--muted-foreground)] transition-colors hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--foreground)]"
              onClick={() => onQueryChange("")}
            >
              <CircleX className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterChip active={directionFilter === "all"} onClick={() => onDirectionFilterChange("all")}>
            All
          </FilterChip>
          {DIRECTIONS.map((direction) => (
            <FilterChip
              key={direction}
              active={directionFilter === direction}
              onClick={() => onDirectionFilterChange(direction)}
            >
              {DIRECTION_LABELS[direction]}
            </FilterChip>
          ))}
        </div>
      </CardHeader>

      <CardContent className="max-h-[70vh] overflow-y-auto p-3">
        <div className="space-y-3">
          {techniques.map((technique) => (
            <TechniqueListItem
              key={technique.id}
              technique={technique}
              isOpen={openTechniqueId === technique.id}
              onToggle={() => onToggle(openTechniqueId === technique.id ? null : technique.id)}
              techniquesById={techniquesById}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TechniqueListItem({
  technique,
  isOpen,
  onToggle,
  techniquesById,
  depth = 0,
}: {
  technique: Technique;
  isOpen: boolean;
  onToggle: () => void;
  techniquesById: Record<string, Technique>;
  depth?: number;
}) {
  const temperature = technique.dimensions.temperature;
  const primaryDirection = technique.dimensions.direction[0];
  const [openChildIds, setOpenChildIds] = useState<string[]>([]);
  const childTechniques = useMemo(
    () =>
      (technique.children ?? [])
        .map((childId) => techniquesById[childId])
        .filter((child): child is Technique => Boolean(child)),
    [technique.children, techniquesById],
  );

  return (
    <div
      className={cn(
        "rounded-[1.25rem] border border-[color:var(--border)]",
        directionSurfaceClass(primaryDirection),
      )}
    >
      <button
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
        onClick={onToggle}
        type="button"
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {technique.dimensions.structure === "protocol" ? <Badge>Protocol</Badge> : null}
            {technique.dimensions.response ? <Badge variant="outline">{labelize(technique.dimensions.response)}</Badge> : null}
            {temperature === "warming" || temperature === "cooling" ? (
              <TemperaturePill temperature={temperature} />
            ) : null}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[color:var(--foreground)]">{technique.title}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {technique.dimensions.direction.map((direction) => (
                <DirectionPill key={direction} direction={direction} />
              ))}
            </div>
          </div>
        </div>
        <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-[color:var(--muted-foreground)] transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen ? (
        <div className="space-y-4 border-t border-[color:var(--border)] px-4 pb-4 pt-1">
          <MarkdownText text={technique.text} />

          {technique.howTo?.length ? (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">How to</h4>
              <ol className="space-y-2 pl-5 text-sm text-[color:var(--muted-foreground)]">
                {technique.howTo.map((step, index) => (
                  <li key={index} className="list-decimal">
                    {step}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {technique.children?.length ? (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Included techniques</h4>
              <div className="space-y-2">
                {childTechniques.map((child) => (
                  <TechniqueListItem
                    key={`${technique.id}:${child.id}`}
                    technique={child}
                    isOpen={openChildIds.includes(child.id)}
                    onToggle={() =>
                      setOpenChildIds((current) =>
                        current.includes(child.id)
                          ? current.filter((entry) => entry !== child.id)
                          : [...current, child.id],
                      )
                    }
                    techniquesById={techniquesById}
                    depth={depth + 1}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type BuilderPanelProps = {
  overallDirection: Direction;
  onOverallDirectionChange: (direction: Direction) => void;
  suggestedProtocols: Technique[];
  techniquesById: Record<string, Technique>;
  builder: BuilderColumn[];
  singles: Technique[];
  variationById: Record<string, VariationDimension>;
  onApplyProtocol: (protocol: Technique, mode: "full" | "directions") => void;
  onReset: () => void;
  onUpdateColumn: (index: number, next: Partial<BuilderColumn>) => void;
  onUpdateVariation: (index: number, variationIndex: number, value: string) => void;
};

function BuilderPanel({
  overallDirection,
  onOverallDirectionChange,
  suggestedProtocols,
  techniquesById,
  builder,
  singles,
  variationById,
  onApplyProtocol,
  onReset,
  onUpdateColumn,
  onUpdateVariation,
}: BuilderPanelProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <Badge variant="accent" className="mb-3 w-fit">
                Builder
              </Badge>
              <CardTitle className="text-3xl">ABC123 protocol composer</CardTitle>
              <CardDescription>
                Start with a target direction, borrow a protocol as inspiration, then fill the 3x3 matrix.
              </CardDescription>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onReset}>
                Reset matrix
              </Button>
              <Button variant="secondary">
                <WandSparkles className="h-4 w-4" />
                Future AI Assist
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {DIRECTIONS.map((direction) => (
              <FilterChip
                key={direction}
                active={overallDirection === direction}
                onClick={() => onOverallDirectionChange(direction)}
                icon={<Sparkles className="h-3.5 w-3.5" />}
              >
                {DIRECTION_LABELS[direction]}
              </FilterChip>
            ))}
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Protocol inspiration</CardTitle>
          <CardDescription>
            Suggested from the selected overall direction. Use a full protocol, or borrow only its column directions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {suggestedProtocols.length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] p-6 text-sm text-[color:var(--muted-foreground)]">
              No curated protocol is currently mapped to this direction. You can still build your sequence manually below.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {suggestedProtocols.map((protocol) => (
                <ProtocolSuggestionCard
                  key={protocol.id}
                  protocol={protocol}
                  techniquesById={techniquesById}
                  onApplyProtocol={onApplyProtocol}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">3x3 matrix</CardTitle>
          <CardDescription>
            Columns are the three techniques. Rows are the three variations for each technique.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 xl:grid-cols-3">
            {builder.map((column, index) => {
              const matchingTechniques = singles.filter((technique) => technique.dimensions.direction.includes(column.direction));
              const selectedTechnique = column.techniqueId ? techniquesById[column.techniqueId] : null;
              const availableVariationIds = selectedTechnique?.variationDimensions ?? [];

              return (
                <Card key={index} className="bg-[color:var(--surface)]">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="outline">Column {index + 1}</Badge>
                      <DirectionPill direction={column.direction} />
                    </div>
                    <CardTitle className="text-2xl">Phase {index + 1}</CardTitle>
                    <CardDescription>Set direction, technique, and three matching variations.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[color:var(--muted-foreground)]">Direction</label>
                      <select
                        className="field-select"
                        value={column.direction}
                        onChange={(event) => onUpdateColumn(index, { direction: event.target.value as Direction, techniqueId: "", variations: ["", "", ""] })}
                      >
                        {DIRECTIONS.map((direction) => (
                          <option key={direction} value={direction}>
                            {DIRECTION_LABELS[direction]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[color:var(--muted-foreground)]">Technique</label>
                      <select
                        className="field-select"
                        value={column.techniqueId}
                        onChange={(event) => onUpdateColumn(index, { techniqueId: event.target.value, variations: ["", "", ""] })}
                      >
                        <option value="">Choose a technique</option>
                        {matchingTechniques.map((technique) => (
                          <option key={technique.id} value={technique.id}>
                            {technique.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedTechnique ? (
                      <>
                        <div className={cn("rounded-[1.25rem] p-4", directionSurfaceClass(selectedTechnique.dimensions.direction[0]))}>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge>{selectedTechnique.title}</Badge>
                            {selectedTechnique.dimensions.direction.map((direction) => (
                              <DirectionPill key={direction} direction={direction} compact />
                            ))}
                          </div>
                          <p className="mt-3 text-sm text-[color:var(--muted-foreground)] line-clamp-5">{selectedTechnique.text}</p>
                        </div>

                        <Separator />

                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--muted-foreground)]">
                            <FileText className="h-4 w-4" />
                            Variations
                          </div>
                          {[0, 1, 2].map((variationIndex) => (
                            <div key={variationIndex} className="space-y-2">
                              <label className="text-sm font-medium text-[color:var(--foreground)]">
                                Variation {variationIndex + 1}
                              </label>
                              <select
                                className="field-select"
                                value={column.variations[variationIndex]}
                                onChange={(event) => onUpdateVariation(index, variationIndex, event.target.value)}
                              >
                                <option value="">Choose a variation dimension</option>
                                {availableVariationIds.map((variationId) => {
                                  const variation = variationById[variationId];
                                  return (
                                    <option key={variationId} value={variationId}>
                                      {variation?.title ?? variationId}
                                    </option>
                                  );
                                })}
                              </select>
                              {column.variations[variationIndex] ? (
                                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 text-sm text-[color:var(--muted-foreground)]">
                                  {variationById[column.variations[variationIndex]]?.text}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-[1.25rem] border border-dashed border-[color:var(--border)] bg-[color:var(--card)] p-4 text-sm text-[color:var(--muted-foreground)]">
                        Pick a technique that matches the current column direction. The variation choices will appear afterwards.
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProtocolSuggestionCard({
  protocol,
  techniquesById,
  onApplyProtocol,
}: {
  protocol: Technique;
  techniquesById: Record<string, Technique>;
  onApplyProtocol: (protocol: Technique, mode: "full" | "directions") => void;
}) {
  return (
    <Card className="bg-[color:var(--surface)]">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{protocol.title}</Badge>
          {protocol.dimensions.direction.map((direction) => (
            <DirectionPill key={direction} direction={direction} compact />
          ))}
        </div>
        <CardDescription>{protocol.text}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {protocol.children?.map((childId, index) => {
            const child = techniquesById[childId];
            if (!child) {
              return null;
            }

            return (
              <div key={`${childId}-${index}`} className={cn("rounded-[1.25rem] p-4", directionSurfaceClass(child.dimensions.direction[0]))}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Badge variant="outline">Step {index + 1}</Badge>
                  <ArrowUpRight className="h-4 w-4 text-[color:var(--muted-foreground)]" />
                </div>
                <div className="space-y-2">
                  <DirectionPill direction={child.dimensions.direction[0]} />
                  <h4 className="font-semibold text-[color:var(--foreground)]">{child.title}</h4>
                  <p className="text-sm text-[color:var(--muted-foreground)] line-clamp-4">{child.text}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onApplyProtocol(protocol, "full")}>Use full protocol</Button>
          <Button variant="outline" onClick={() => onApplyProtocol(protocol, "directions")}>
            Use column directions
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-transparent bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function DirectionPill({ direction, compact = false }: { direction: Direction; compact?: boolean }) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        direction === "up" && "bg-[color:var(--up-chip)] text-[color:var(--up-chip-fg)]",
        direction === "down" && "bg-[color:var(--down-chip)] text-[color:var(--down-chip-fg)]",
        direction === "horizontal" && "bg-[color:var(--horizontal-chip)] text-[color:var(--horizontal-chip-fg)]",
        direction === "restorative" && "bg-[color:var(--restorative-chip)] text-[color:var(--restorative-chip-fg)]",
        direction === "functional" && "bg-[color:var(--functional-chip)] text-[color:var(--functional-chip-fg)]",
        compact && "px-2 py-0.5 text-[10px]",
      )}
    >
      {DIRECTION_LABELS[direction]}
    </div>
  );
}

function TemperaturePill({ temperature }: { temperature: "warming" | "cooling" }) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        temperature === "warming" && "bg-[color:var(--warming-chip)] text-[color:var(--warming-chip-fg)]",
        temperature === "cooling" && "bg-[color:var(--cooling-chip)] text-[color:var(--cooling-chip-fg)]",
      )}
    >
      {labelize(temperature)}
    </div>
  );
}

function directionSurfaceClass(direction: Direction) {
  if (direction === "up") {
    return "bg-[color:var(--up-surface)]";
  }

  if (direction === "down") {
    return "bg-[color:var(--down-surface)]";
  }

  if (direction === "horizontal") {
    return "bg-[color:var(--horizontal-surface)]";
  }

  if (direction === "restorative") {
    return "bg-[color:var(--restorative-surface)]";
  }

  return "bg-[color:var(--functional-surface)]";
}

function MarkdownText({ text }: { text: string }) {
  const paragraphs = text.split("\n").filter((paragraph) => paragraph.trim().length > 0);

  return (
    <div className="space-y-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}

function labelize(value: string) {
  return value.replaceAll("-", " ");
}

export default App;
