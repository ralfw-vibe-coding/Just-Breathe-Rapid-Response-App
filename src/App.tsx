import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  CircleX,
  ChevronDown,
  Copy,
  FileText,
  Info,
  GitBranchPlus,
  Play,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  Timer,
  X,
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
  direction: Direction | "";
  techniqueId: string;
  variationDimensionId: string;
  variationValues: string[];
};

type AiSuggestionPhase = {
  position: number;
  direction: Direction;
  techniqueId: string;
  variationDimensionId: string;
  variationA: string;
  variationB: string;
  variationC: string;
};

type AiSuggestion = {
  id: string;
  title: string;
  summary: string;
  rationale: string;
  overallDirection: Direction;
  phases: AiSuggestionPhase[];
};

type PrintableProtocolColumn = {
  position: number;
  direction: Direction | "";
  technique: Technique | null;
  variationDimension: VariationDimension | null;
  variationValues: string[];
};

type WakeLockSentinelLike = EventTarget & {
  release: () => Promise<void>;
};

type WakeLockCapableNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
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
  { direction: "", techniqueId: "", variationDimensionId: "", variationValues: ["", "", ""] },
  { direction: "", techniqueId: "", variationDimensionId: "", variationValues: ["", "", ""] },
  { direction: "", techniqueId: "", variationDimensionId: "", variationValues: ["", "", ""] },
];
const STORAGE_KEY = "jbr2-custom-protocol";

type PersistedBuilderState = {
  overallDirection: Direction | "";
  builder: BuilderColumn[];
  isInspirationCollapsed: boolean;
  inspirationTab: "protocols" | "ai";
  aiCaseInput: string;
  aiOverallHint: Direction | "";
  aiPhaseHints: Array<Direction | "">;
  aiSuggestions: AiSuggestion[];
};

function App() {
  const [base, setBase] = useState<BaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState<Direction | "all">("all");
  const [mobileTab, setMobileTab] = useState("base");
  const [openTechniqueId, setOpenTechniqueId] = useState<string | null>(null);
  const [overallDirection, setOverallDirection] = useState<Direction | "">("");
  const [builder, setBuilder] = useState<BuilderColumn[]>(DEFAULT_BUILDER);
  const [isInspirationCollapsed, setIsInspirationCollapsed] = useState(false);
  const [inspirationTab, setInspirationTab] = useState<"protocols" | "ai">("protocols");
  const [aiCaseInput, setAiCaseInput] = useState("");
  const [aiOverallHint, setAiOverallHint] = useState<Direction | "">("");
  const [aiPhaseHints, setAiPhaseHints] = useState<Array<Direction | "">>(["", "", ""]);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [hasHydratedBuilder, setHasHydratedBuilder] = useState(false);

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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHasHydratedBuilder(true);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<PersistedBuilderState>;
      if (!parsed || !Array.isArray(parsed.builder) || parsed.builder.length !== 3) {
        setHasHydratedBuilder(true);
        return;
      }

      setOverallDirection(
        parsed.overallDirection === "" || DIRECTIONS.includes(parsed.overallDirection as Direction)
          ? (parsed.overallDirection as Direction | "")
          : "",
      );
      setBuilder(
        parsed.builder.map((column) => ({
          direction:
            column.direction === "" || DIRECTIONS.includes(column.direction as Direction)
              ? (column.direction as Direction | "")
              : "",
          techniqueId: typeof column.techniqueId === "string" ? column.techniqueId : "",
          variationDimensionId:
            typeof column.variationDimensionId === "string" ? column.variationDimensionId : "",
          variationValues:
            Array.isArray(column.variationValues) && column.variationValues.length === 3
              ? column.variationValues.map((value) => (typeof value === "string" ? value : ""))
              : ["", "", ""],
        })),
      );
      setIsInspirationCollapsed(Boolean(parsed.isInspirationCollapsed));
      setInspirationTab(parsed.inspirationTab === "ai" ? "ai" : "protocols");
      setAiCaseInput(typeof parsed.aiCaseInput === "string" ? parsed.aiCaseInput : "");
      setAiOverallHint(
        parsed.aiOverallHint === "" || DIRECTIONS.includes(parsed.aiOverallHint as Direction)
          ? (parsed.aiOverallHint as Direction | "")
          : "",
      );
      setAiPhaseHints(
        Array.isArray(parsed.aiPhaseHints) && parsed.aiPhaseHints.length === 3
          ? parsed.aiPhaseHints.map((hint) =>
              hint === "" || DIRECTIONS.includes(hint as Direction) ? (hint as Direction | "") : "",
            )
          : ["", "", ""],
      );
      setAiSuggestions(Array.isArray(parsed.aiSuggestions) ? parsed.aiSuggestions : []);
      setHasHydratedBuilder(true);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      setHasHydratedBuilder(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydratedBuilder) {
      return;
    }

    const payload: PersistedBuilderState = {
      overallDirection,
      builder,
      isInspirationCollapsed,
      inspirationTab,
      aiCaseInput,
      aiOverallHint,
      aiPhaseHints,
      aiSuggestions,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [overallDirection, builder, isInspirationCollapsed, inspirationTab, aiCaseInput, aiOverallHint, aiPhaseHints, aiSuggestions, hasHydratedBuilder]);

  useEffect(() => {
    if (!openTechniqueId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const element = document.getElementById(`technique-${openTechniqueId}`);
      element?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);

    return () => window.clearTimeout(timeoutId);
  }, [mobileTab, openTechniqueId]);

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

  const suggestedProtocols =
    overallDirection === ""
      ? []
      : PRESET_PROTOCOLS[overallDirection]
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
          variationValues: column.variationValues.map((variation, currentVariationIndex) =>
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
        variationDimensionId: "",
        variationValues: ["", "", ""],
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
    setOverallDirection("");
    setIsInspirationCollapsed(false);
    setInspirationTab("protocols");
    setAiCaseInput("");
    setAiOverallHint("");
    setAiPhaseHints(["", "", ""]);
    setAiSuggestions([]);
    setAiError(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  function applyTechniqueToColumn(index: number, technique: Technique) {
    updateColumn(index, {
      direction: technique.dimensions.direction[0] ?? "",
      techniqueId: technique.id,
      variationDimensionId: "",
      variationValues: ["", "", ""],
    });
    setMobileTab("builder");
  }

  function revealInBase(techniqueId: string) {
    setOpenTechniqueId(techniqueId);
    setMobileTab("base");
  }

  async function generateAiSuggestions() {
    setAiError(null);
    setIsAiLoading(true);

    try {
      const response = await fetch("/api/ai-protocol-suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientDescription: aiCaseInput,
          overallDirectionHint: aiOverallHint || undefined,
          phaseHints: aiPhaseHints,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "AI assistant request failed.");
      }

      setAiSuggestions(payload.suggestions ?? []);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Unknown AI assistant error");
    } finally {
      setIsAiLoading(false);
    }
  }

  function applyAiSuggestion(suggestion: AiSuggestion) {
    setOverallDirection(suggestion.overallDirection);
    setBuilder(
      suggestion.phases.map((phase) => ({
        direction: phase.direction,
        techniqueId: phase.techniqueId,
        variationDimensionId: phase.variationDimensionId,
        variationValues: [phase.variationA, phase.variationB, phase.variationC],
      })),
    );
    setMobileTab("builder");
  }

  function removeAiSuggestion(suggestionId: string) {
    setAiSuggestions((current) => current.filter((suggestion) => suggestion.id !== suggestionId));
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
            isInspirationCollapsed={isInspirationCollapsed}
            onToggleInspirationCollapsed={() => setIsInspirationCollapsed((current) => !current)}
            inspirationTab={inspirationTab}
            onInspirationTabChange={setInspirationTab}
            aiCaseInput={aiCaseInput}
            onAiCaseInputChange={setAiCaseInput}
            aiOverallHint={aiOverallHint}
            onAiOverallHintChange={setAiOverallHint}
            aiPhaseHints={aiPhaseHints}
            onAiPhaseHintsChange={setAiPhaseHints}
            aiSuggestions={aiSuggestions}
            aiError={aiError}
            isAiLoading={isAiLoading}
            onGenerateAiSuggestions={() => void generateAiSuggestions()}
            onClearAiAssistant={() => {
              setAiCaseInput("");
              setAiOverallHint("");
              setAiPhaseHints(["", "", ""]);
              setAiSuggestions([]);
              setAiError(null);
            }}
            onApplyAiSuggestion={applyAiSuggestion}
            onDiscardAiSuggestion={removeAiSuggestion}
            techniquesById={techniquesById}
            builder={builder}
            singles={singles}
            variationById={variationById}
            onApplyProtocol={applyProtocol}
            onApplyTechniqueToColumn={applyTechniqueToColumn}
            onRevealInBase={revealInBase}
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
          isInspirationCollapsed={isInspirationCollapsed}
          onToggleInspirationCollapsed={() => setIsInspirationCollapsed((current) => !current)}
          inspirationTab={inspirationTab}
          onInspirationTabChange={setInspirationTab}
          aiCaseInput={aiCaseInput}
          onAiCaseInputChange={setAiCaseInput}
          aiOverallHint={aiOverallHint}
          onAiOverallHintChange={setAiOverallHint}
          aiPhaseHints={aiPhaseHints}
          onAiPhaseHintsChange={setAiPhaseHints}
          aiSuggestions={aiSuggestions}
          aiError={aiError}
          isAiLoading={isAiLoading}
          onGenerateAiSuggestions={() => void generateAiSuggestions()}
          onClearAiAssistant={() => {
            setAiCaseInput("");
            setAiOverallHint("");
            setAiPhaseHints(["", "", ""]);
            setAiSuggestions([]);
            setAiError(null);
          }}
          onApplyAiSuggestion={applyAiSuggestion}
          onDiscardAiSuggestion={removeAiSuggestion}
          techniquesById={techniquesById}
          builder={builder}
          singles={singles}
          variationById={variationById}
          onApplyProtocol={applyProtocol}
          onApplyTechniqueToColumn={applyTechniqueToColumn}
          onRevealInBase={revealInBase}
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
    <Card className="overflow-hidden lg:sticky lg:top-6 lg:flex lg:h-[calc(100vh-3rem)] lg:flex-col">
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

      <CardContent className="min-h-0 overflow-y-auto p-3 lg:flex-1">
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
      id={depth === 0 ? `technique-${technique.id}` : undefined}
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
  overallDirection: Direction | "";
  onOverallDirectionChange: (direction: Direction | "") => void;
  suggestedProtocols: Technique[];
  isInspirationCollapsed: boolean;
  onToggleInspirationCollapsed: () => void;
  inspirationTab: "protocols" | "ai";
  onInspirationTabChange: (value: "protocols" | "ai") => void;
  aiCaseInput: string;
  onAiCaseInputChange: (value: string) => void;
  aiOverallHint: Direction | "";
  onAiOverallHintChange: (value: Direction | "") => void;
  aiPhaseHints: Array<Direction | "">;
  onAiPhaseHintsChange: (value: Array<Direction | "">) => void;
  aiSuggestions: AiSuggestion[];
  aiError: string | null;
  isAiLoading: boolean;
  onGenerateAiSuggestions: () => void;
  onClearAiAssistant: () => void;
  onApplyAiSuggestion: (suggestion: AiSuggestion) => void;
  onDiscardAiSuggestion: (suggestionId: string) => void;
  techniquesById: Record<string, Technique>;
  builder: BuilderColumn[];
  singles: Technique[];
  variationById: Record<string, VariationDimension>;
  onApplyProtocol: (protocol: Technique, mode: "full" | "directions") => void;
  onApplyTechniqueToColumn: (index: number, technique: Technique) => void;
  onRevealInBase: (techniqueId: string) => void;
  onReset: () => void;
  onUpdateColumn: (index: number, next: Partial<BuilderColumn>) => void;
  onUpdateVariation: (index: number, variationIndex: number, value: string) => void;
};

function BuilderPanel({
  overallDirection,
  onOverallDirectionChange,
  suggestedProtocols,
  isInspirationCollapsed,
  onToggleInspirationCollapsed,
  inspirationTab,
  onInspirationTabChange,
  aiCaseInput,
  onAiCaseInputChange,
  aiOverallHint,
  onAiOverallHintChange,
  aiPhaseHints,
  onAiPhaseHintsChange,
  aiSuggestions,
  aiError,
  isAiLoading,
  onGenerateAiSuggestions,
  onClearAiAssistant,
  onApplyAiSuggestion,
  onDiscardAiSuggestion,
  techniquesById,
  builder,
  singles,
  variationById,
  onApplyProtocol,
  onApplyTechniqueToColumn,
  onRevealInBase,
  onReset,
  onUpdateColumn,
  onUpdateVariation,
}: BuilderPanelProps) {
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [isPracticeTimerOpen, setIsPracticeTimerOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  const printableColumns: PrintableProtocolColumn[] = builder.map((column, index) => ({
    position: index + 1,
    direction: column.direction,
    technique: column.techniqueId ? techniquesById[column.techniqueId] ?? null : null,
    variationDimension: column.variationDimensionId ? variationById[column.variationDimensionId] ?? null : null,
    variationValues: column.variationValues,
  }));

  async function copyPrintableProtocol() {
    setCopyStatus("idle");

    try {
      await copyProtocolToClipboard(printableColumns);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    } catch {
      setCopyStatus("failed");
      window.setTimeout(() => setCopyStatus("idle"), 2200);
    }
  }

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
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterChip active={overallDirection === ""} onClick={() => onOverallDirectionChange("")}>
              None
            </FilterChip>
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">Inspiration</CardTitle>
              <CardDescription>
                Use either curated protocol inspiration or the AI assistant to generate ideas for your custom protocol.
              </CardDescription>
            </div>
            <IconActionButton
              label={isInspirationCollapsed ? "Expand inspiration" : "Collapse inspiration"}
              onClick={onToggleInspirationCollapsed}
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  isInspirationCollapsed ? "rotate-0" : "rotate-180",
                )}
              />
            </IconActionButton>
          </div>
        </CardHeader>
        {isInspirationCollapsed ? null : (
          <CardContent className="space-y-6">
            <Tabs value={inspirationTab} onValueChange={(value) => onInspirationTabChange(value as "protocols" | "ai")}>
              <TabsList>
                <TabsTrigger value="protocols">Protocol inspiration</TabsTrigger>
                <TabsTrigger value="ai">AI Assistant</TabsTrigger>
              </TabsList>

              <TabsContent value="protocols" className="space-y-4">
                {overallDirection === "" ? (
                  <div className="rounded-[1.25rem] border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] p-6 text-sm text-[color:var(--muted-foreground)]">
                    Choose an overall direction to see protocol suggestions.
                  </div>
                ) : suggestedProtocols.length === 0 ? (
                  <div className="rounded-[1.25rem] border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] p-6 text-sm text-[color:var(--muted-foreground)]">
                    No curated protocol is currently mapped to this direction. You can still build your sequence manually below.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {suggestedProtocols.map((protocol) => (
                      <ProtocolSuggestionCard
                        key={protocol.id}
                        protocol={protocol}
                        techniquesById={techniquesById}
                        onApplyProtocol={onApplyProtocol}
                        onApplyTechniqueToColumn={onApplyTechniqueToColumn}
                        onRevealInBase={onRevealInBase}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="ai" className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[color:var(--muted-foreground)]">
                    What did you observe and what did the client tell you?
                  </label>
                  <textarea
                    className="min-h-36 w-full rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-sm text-[color:var(--foreground)] outline-none transition-colors placeholder:text-[color:var(--muted-foreground)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                    value={aiCaseInput}
                    onChange={(event) => onAiCaseInputChange(event.target.value)}
                    placeholder="Describe the client's situation, stress state, energy level, emotional tone, breathing pattern, and what support seems needed."
                  />
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium text-[color:var(--muted-foreground)]">Overall direction hint</div>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip active={aiOverallHint === ""} onClick={() => onAiOverallHintChange("")}>
                      Any
                    </FilterChip>
                    {DIRECTIONS.map((direction) => (
                      <DirectionSelectChip
                        key={direction}
                        direction={direction}
                        active={aiOverallHint === direction}
                        onClick={() => onAiOverallHintChange(direction)}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium text-[color:var(--muted-foreground)]">Phase direction hints</div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {aiPhaseHints.map((hint, index) => (
                      <div key={index} className="rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
                        <div className="mb-3 text-sm font-semibold text-[color:var(--foreground)]">
                          Phase {index + 1}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <FilterChip
                            active={hint === ""}
                            onClick={() =>
                              onAiPhaseHintsChange(
                                aiPhaseHints.map((value, valueIndex) => (valueIndex === index ? "" : value)),
                              )
                            }
                          >
                            Any
                          </FilterChip>
                          {DIRECTIONS.map((direction) => (
                            <DirectionSelectChip
                              key={direction}
                              direction={direction}
                              active={hint === direction}
                              onClick={() =>
                                onAiPhaseHintsChange(
                                  aiPhaseHints.map((value, valueIndex) => (valueIndex === index ? direction : value)),
                                )
                              }
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={onGenerateAiSuggestions} disabled={isAiLoading || aiCaseInput.trim().length < 10}>
                    {isAiLoading ? "Generating..." : "Generate 3 protocol suggestions"}
                  </Button>
                  <Button variant="outline" onClick={onClearAiAssistant}>
                    Clear
                  </Button>
                </div>

                {aiError ? (
                  <div className="rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-sm text-[color:var(--up-chip)]">
                    {aiError}
                  </div>
                ) : null}

                {aiSuggestions.length > 0 ? (
                  <div className="space-y-4">
                    {aiSuggestions.map((suggestion) => (
                      <AiSuggestionCard
                        key={suggestion.id}
                        suggestion={suggestion}
                        techniquesById={techniquesById}
                        variationById={variationById}
                        onApply={() => onApplyAiSuggestion(suggestion)}
                        onDiscard={() => onDiscardAiSuggestion(suggestion.id)}
                      />
                    ))}
                  </div>
                ) : null}
              </TabsContent>
            </Tabs>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">Custom protocol</CardTitle>
              <CardDescription>
                Columns are the three techniques. Rows are the three variations for each technique.
              </CardDescription>
            </div>
            <div className="flex shrink-0 gap-2">
              <IconActionButton label="Open practice timer" onClick={() => setIsPracticeTimerOpen(true)}>
                <Timer className="h-4 w-4" />
              </IconActionButton>
              <IconActionButton label="Open print preview" onClick={() => setIsPrintPreviewOpen(true)}>
                <Printer className="h-4 w-4" />
              </IconActionButton>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 xl:grid-cols-3">
            {builder.map((column, index) => {
              const matchingTechniques =
                column.direction === ""
                  ? []
                  : singles
                      .filter((technique) => technique.dimensions.direction.includes(column.direction as Direction))
                      .sort((a, b) => a.title.localeCompare(b.title));
              const selectedTechnique = column.techniqueId ? techniquesById[column.techniqueId] : null;
              const availableVariationIds = selectedTechnique?.variationDimensions ?? [];

              return (
                <Card key={index} className="bg-[color:var(--surface)]">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-4xl font-[var(--font-display)] leading-none text-[color:var(--muted-foreground)]">
                        {index + 1}.
                      </div>
                      <div className="flex max-w-[70%] flex-wrap justify-end gap-2">
                        {DIRECTIONS.map((direction) => (
                          <DirectionSelectChip
                            key={direction}
                            direction={direction}
                            active={column.direction === direction}
                            onClick={() =>
                              onUpdateColumn(index, {
                                direction,
                                techniqueId: "",
                                variationDimensionId: "",
                                variationValues: ["", "", ""],
                              })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {column.direction === "" ? (
                      <div className="rounded-[1rem] border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
                        Choose a direction first.
                      </div>
                    ) : (
                      <select
                        className="field-select"
                        value={column.techniqueId}
                        onChange={(event) =>
                          onUpdateColumn(index, {
                            techniqueId: event.target.value,
                            variationDimensionId: "",
                            variationValues: ["", "", ""],
                          })
                        }
                      >
                        <option value="">Choose a technique</option>
                        {matchingTechniques.map((technique) => (
                          <option key={technique.id} value={technique.id}>
                            {technique.title}
                          </option>
                        ))}
                      </select>
                    )}

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
                          {selectedTechnique.howTo?.length ? (
                            <div className="mt-4 space-y-2">
                              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                                How to
                              </div>
                              <ol className="space-y-1 pl-5 text-sm text-[color:var(--muted-foreground)]">
                                {selectedTechnique.howTo.map((step, stepIndex) => (
                                  <li key={stepIndex} className="list-decimal">
                                    {step}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          ) : null}
                        </div>

                        <Separator />

                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--muted-foreground)]">
                            <FileText className="h-4 w-4" />
                            Variations
                          </div>
                          <select
                            className="field-select"
                            value={column.variationDimensionId}
                            onChange={(event) =>
                              onUpdateColumn(index, {
                                variationDimensionId: event.target.value,
                                variationValues: [
                                  variationById[event.target.value]?.text ?? "",
                                  "",
                                  "",
                                ],
                              })
                            }
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
                          {(["A", "B", "C"] as const).map((label, variationIndex) => (
                            <div key={label} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="w-5 text-sm font-semibold text-[color:var(--muted-foreground)]">
                                  {label}
                                </div>
                                <div className="relative flex-1">
                                  <textarea
                                    className={cn(
                                      "flex w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 pr-11 text-sm text-[color:var(--foreground)] outline-none transition-colors placeholder:text-[color:var(--muted-foreground)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] resize-y",
                                      variationIndex === 0 ? "min-h-32" : "min-h-24",
                                    )}
                                    value={column.variationValues[variationIndex]}
                                    onChange={(event) => onUpdateVariation(index, variationIndex, event.target.value)}
                                    placeholder={`Describe variation ${label}`}
                                  />
                                  {column.variationValues[variationIndex] ? (
                                    <button
                                      type="button"
                                      aria-label={`Clear variation ${label}`}
                                      className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--muted-foreground)] transition-colors hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--foreground)]"
                                      onClick={() => onUpdateVariation(index, variationIndex, "")}
                                    >
                                      <CircleX className="h-4 w-4" />
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-[1.25rem] border border-dashed border-[color:var(--border)] bg-[color:var(--card)] p-4 text-sm text-[color:var(--muted-foreground)]">
                        {column.direction === ""
                          ? "Choose a direction first. Then you can pick a matching technique and define the three variations."
                          : "Pick a technique that matches the current column direction. The variation choices will appear afterwards."}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {isPrintPreviewOpen ? (
        <ProtocolPrintPreview
          columns={printableColumns}
          copyStatus={copyStatus}
          onClose={() => setIsPrintPreviewOpen(false)}
          onCopy={copyPrintableProtocol}
          onPrint={() => window.print()}
        />
      ) : null}
      <PracticeTimerPanel columns={printableColumns} isOpen={isPracticeTimerOpen} onClose={() => setIsPracticeTimerOpen(false)} />
    </div>
  );
}

function ProtocolPrintPreview({
  columns,
  copyStatus,
  onClose,
  onCopy,
  onPrint,
}: {
  columns: PrintableProtocolColumn[];
  copyStatus: "idle" | "copied" | "failed";
  onClose: () => void;
  onCopy: () => void;
  onPrint: () => void;
}) {
  const printPageRef = useRef<HTMLDivElement>(null);
  const variationLabels = ["A", "B", "C"];

  useEffect(() => {
    document.body.classList.add("print-preview-active");

    return () => {
      document.body.classList.remove("print-preview-active");
    };
  }, []);

  return createPortal(
    <div className="print-overlay" role="dialog" aria-modal="true" aria-label="Printable custom protocol">
      <div className="print-preview-shell">
        <div className="print-toolbar">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              Print format
            </div>
            <h2 className="font-[var(--font-display)] text-2xl text-[color:var(--foreground)]">Custom protocol</h2>
          </div>
          <div className="flex gap-2">
            <IconActionButton label="Copy protocol matrix" onClick={onCopy}>
              {copyStatus === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </IconActionButton>
            <IconActionButton label="Print protocol matrix" onClick={onPrint}>
              <Printer className="h-4 w-4" />
            </IconActionButton>
            <IconActionButton label="Close print preview" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconActionButton>
          </div>
        </div>

        {copyStatus === "failed" ? (
          <div className="mb-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--up-surface)] px-4 py-2 text-sm text-[color:var(--up-chip)]">
            Copy failed. Your browser may require allowing clipboard access.
          </div>
        ) : null}

        <div ref={printPageRef} className="print-page">
          <div className="print-page-header">
            <div>
              <div className="print-kicker">JBR2</div>
              <h1>Custom protocol</h1>
            </div>
            <div className="print-claim">Custom breathwork protocols made easy</div>
          </div>

          <div className="print-matrix-grid">
            {columns.map((column) => (
              <div key={`technique-${column.position}`} className="print-cell print-technique-cell">
                <div className="print-cell-heading">
                  <div className="print-position">{column.position}.</div>
                  {column.direction ? <DirectionPill direction={column.direction} compact /> : <span className="print-empty-pill">No direction</span>}
                </div>
                <h3>{column.technique?.title ?? "No technique selected"}</h3>
                {column.technique ? (
                  <>
                    <p>{column.technique.text}</p>
                    {column.technique.howTo?.length ? (
                      <div className="print-howto">
                        <div>How to</div>
                        <ol>
                          {column.technique.howTo.map((step, index) => (
                            <li key={index}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="print-placeholder">Choose a technique before printing the protocol.</p>
                )}
              </div>
            ))}

            {variationLabels.map((label, variationIndex) =>
              columns.map((column) => (
                <div key={`${label}-${column.position}`} className="print-cell print-variation-cell">
                  <div className="print-variation-label">{label}</div>
                  <div>
                    {variationIndex === 0 && column.variationDimension ? (
                      <div className="print-variation-dimension">{column.variationDimension.title}</div>
                    ) : null}
                    <p>{column.variationValues[variationIndex]?.trim() || "No variation written yet."}</p>
                  </div>
                </div>
              )),
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PracticeTimerPanel({
  columns,
  isOpen,
  onClose,
}: {
  columns: PrintableProtocolColumn[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [protocolStartedAt, setProtocolStartedAt] = useState<number | null>(null);
  const [protocolElapsedBefore, setProtocolElapsedBefore] = useState(0);
  const [variantStartedAt, setVariantStartedAt] = useState<number | null>(null);
  const [variantElapsedBefore, setVariantElapsedBefore] = useState(0);
  const [activeCellIndex, setActiveCellIndex] = useState<number | null>(null);
  const [completedIndexes, setCompletedIndexes] = useState<number[]>([]);
  const [wakeLockStatus, setWakeLockStatus] = useState<"idle" | "active" | "unsupported" | "failed">("idle");
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const practiceCells = columns.flatMap((column) =>
    ["A", "B", "C"].map((label, variationIndex) => ({
      index: (column.position - 1) * 3 + variationIndex,
      label: `${column.position}${label}`,
      techniqueTitle: column.technique?.title ?? "No technique selected",
      variationText: column.variationValues[variationIndex]?.trim() || "No variation written yet.",
      isReady: Boolean(column.technique),
    })),
  );
  const activeCell = activeCellIndex === null ? null : practiceCells[activeCellIndex] ?? null;
  const protocolElapsed = protocolElapsedBefore + (protocolStartedAt ? now - protocolStartedAt : 0);
  const variantElapsed = variantElapsedBefore + (variantStartedAt ? now - variantStartedAt : 0);
  const isProtocolRunning = protocolStartedAt !== null;
  const isVariantRunning = variantStartedAt !== null;
  const isComplete = completedIndexes.length >= practiceCells.length;
  const progressGrid = (
    <PracticeProgressGrid
      columns={columns}
      activeCellIndex={activeCellIndex}
      completedIndexes={completedIndexes}
      onSelectCell={selectVariation}
    />
  );

  useEffect(() => {
    if (!protocolStartedAt && !variantStartedAt) {
      return;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [protocolStartedAt, variantStartedAt]);

  useEffect(() => {
    let cancelled = false;

    async function releaseWakeLock() {
      const wakeLock = wakeLockRef.current;
      wakeLockRef.current = null;

      if (wakeLock) {
        await wakeLock.release().catch(() => undefined);
      }
    }

    async function requestWakeLock() {
      const wakeLockNavigator = navigator as WakeLockCapableNavigator;

      if (!wakeLockNavigator.wakeLock) {
        setWakeLockStatus("unsupported");
        return;
      }

      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        await releaseWakeLock();
        const wakeLock = await wakeLockNavigator.wakeLock.request("screen");

        if (cancelled) {
          await wakeLock.release().catch(() => undefined);
          return;
        }

        wakeLockRef.current = wakeLock;
        setWakeLockStatus("active");
        wakeLock.addEventListener("release", () => {
          if (!cancelled) {
            wakeLockRef.current = null;
            setWakeLockStatus(protocolStartedAt ? "failed" : "idle");
          }
        });
      } catch {
        if (!cancelled) {
          wakeLockRef.current = null;
          setWakeLockStatus("failed");
        }
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    }

    if (!protocolStartedAt) {
      setWakeLockStatus("idle");
      void releaseWakeLock();
      return () => {
        cancelled = true;
      };
    }

    void requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void releaseWakeLock();
    };
  }, [protocolStartedAt]);

  function startProtocol() {
    if (isProtocolRunning) {
      return;
    }

    setNow(Date.now());
    setProtocolStartedAt(Date.now());
  }

  function pauseProtocol() {
    stopProtocol();
  }

  function stopProtocol() {
    const stoppedAt = Date.now();

    if (protocolStartedAt) {
      setProtocolElapsedBefore((elapsed) => elapsed + stoppedAt - protocolStartedAt);
      setProtocolStartedAt(null);
    }

    if (variantStartedAt) {
      setVariantElapsedBefore((elapsed) => elapsed + stoppedAt - variantStartedAt);
      setVariantStartedAt(null);
    }

    setNow(stoppedAt);
  }

  function resetPractice() {
    const resetAt = Date.now();
    setNow(resetAt);
    setProtocolStartedAt(null);
    setProtocolElapsedBefore(0);
    setVariantStartedAt(null);
    setVariantElapsedBefore(0);
    setActiveCellIndex(null);
    setCompletedIndexes([]);
  }

  function selectVariation(cellIndex: number) {
    const selectedAt = Date.now();
    setActiveCellIndex(cellIndex);
    setVariantStartedAt(null);
    setVariantElapsedBefore(0);
    setNow(selectedAt);
  }

  function startSelectedVariant() {
    if (!isProtocolRunning || activeCellIndex === null || isVariantRunning) {
      return;
    }

    const startedAt = Date.now();
    setVariantStartedAt(startedAt);
    setVariantElapsedBefore(0);
    setNow(startedAt);
  }

  function startOrAdvanceVariant() {
    if (!isProtocolRunning) {
      return;
    }

    const nextCompleted = activeCellIndex === null ? completedIndexes : uniqueNumbers([...completedIndexes, activeCellIndex]);
    const nextIndex =
      activeCellIndex === null
        ? practiceCells.find((cell) => !nextCompleted.includes(cell.index))?.index ?? null
        : practiceCells.find((cell) => cell.index > activeCellIndex && !nextCompleted.includes(cell.index))?.index ??
          practiceCells.find((cell) => !nextCompleted.includes(cell.index))?.index ??
          null;
    const startedAt = Date.now();

    setCompletedIndexes(nextCompleted);
    setActiveCellIndex(nextIndex);
    setVariantElapsedBefore(0);
    setVariantStartedAt(nextIndex === null ? null : startedAt);
    setNow(startedAt);
  }

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="practice-overlay" role="dialog" aria-modal="true" aria-label="Practice timer">
      <div className="practice-overlay-shell">
        <div className="practice-toolbar">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              Practice mode
            </div>
            <h2 className="font-[var(--font-display)] text-2xl text-[color:var(--foreground)]">Practice timer</h2>
          </div>
          <IconActionButton label="Close practice timer" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconActionButton>
        </div>

        <Card className="practice-timer-card">
          <CardHeader>
            <CardDescription>
              Start the protocol timer, then move manually through ABC123 while tracking the active variation.
            </CardDescription>
            {wakeLockStatus !== "idle" ? (
              <div className="text-xs font-medium text-[color:var(--muted-foreground)]">
                Screen awake: {wakeLockStatus === "active" ? "active" : wakeLockStatus === "unsupported" ? "not supported by this browser" : "not available right now"}
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            <div className="practice-remote">
              <div className="text-center">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                  Protocol elapsed
                </div>
                <div className="mt-1 font-[var(--font-body)] text-6xl font-bold tabular-nums text-[color:var(--foreground)]">
                  {formatDuration(protocolElapsed)}
                </div>
              </div>

              <div className="practice-progress-compact">
                <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                  ABC123
                </div>
                {progressGrid}
              </div>

              <div className="grid gap-2">
                {isProtocolRunning ? (
                  <Button onClick={pauseProtocol}>
                    <Square className="mr-2 h-4 w-4" />
                    Pause
                  </Button>
                ) : (
                  <Button onClick={startProtocol}>
                    <Play className="mr-2 h-4 w-4" />
                    {protocolElapsedBefore > 0 ? "Resume protocol" : "Start protocol"}
                  </Button>
                )}
                <Button variant="outline" onClick={resetPractice}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>

              <Separator />

              <div className="text-center">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                  Current variation
                </div>
                <div className="mt-1 font-[var(--font-body)] text-4xl font-bold tabular-nums text-[color:var(--foreground)]">
                  {formatDuration(variantElapsed)}
                </div>
              </div>

              <Button
                onClick={
                  activeCellIndex === null || isVariantRunning
                    ? startOrAdvanceVariant
                    : startSelectedVariant
                }
                disabled={!isProtocolRunning || isComplete}
              >
                {activeCellIndex === null
                  ? "Start first variation"
                  : isComplete
                    ? "All variations covered"
                    : isVariantRunning
                      ? "Complete & next variation"
                      : "Start variation"}
              </Button>

              <div className="rounded-[1.25rem] bg-[color:var(--card)] p-4">
                {activeCell ? (
                  <>
                    <div className="text-2xl font-semibold leading-tight text-[color:var(--foreground)]">
                      {activeCell.label} {activeCell.techniqueTitle}
                    </div>
                    <p className="mt-3 text-lg leading-7 text-[color:var(--muted-foreground)]">{activeCell.variationText}</p>
                  </>
                ) : (
                  <p className="text-base leading-7 text-[color:var(--muted-foreground)]">
                    {isProtocolRunning
                      ? "Start the first variation when you are ready."
                      : "Start the protocol timer before moving through the variations."}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>,
    document.body,
  );
}

function PracticeProgressGrid({
  columns,
  activeCellIndex,
  completedIndexes,
  onSelectCell,
}: {
  columns: PrintableProtocolColumn[];
  activeCellIndex: number | null;
  completedIndexes: number[];
  onSelectCell: (cellIndex: number) => void;
}) {
  return (
    <div className="practice-progress-grid">
      {["A", "B", "C"].map((variationLabel, variationIndex) =>
        columns.map((column) => {
          const cellIndex = (column.position - 1) * 3 + variationIndex;
          const isActive = activeCellIndex === cellIndex;
          const isDone = completedIndexes.includes(cellIndex);
          const isReady = Boolean(column.technique);

          return (
            <button
              type="button"
              aria-label={`Jump to variation ${column.position}${variationLabel}`}
              onClick={() => onSelectCell(cellIndex)}
              key={`${column.position}${variationLabel}`}
              className={cn(
                "practice-progress-cell",
                isDone && "practice-progress-cell-done",
                isActive && "practice-progress-cell-active",
                !isReady && "practice-progress-cell-muted",
              )}
            >
              {column.position}
              {variationLabel}
            </button>
          );
        }),
      )}
    </div>
  );
}

async function copyProtocolToClipboard(columns: PrintableProtocolColumn[]) {
  const plainText = buildPlainTextProtocol(columns);
  const html = buildHtmlProtocol(columns);
  const clipboardItem = "ClipboardItem" in window ? window.ClipboardItem : null;

  if (clipboardItem && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new clipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      }),
    ]);
    return;
  }

  await navigator.clipboard.writeText(plainText);
}

function buildPlainTextProtocol(columns: PrintableProtocolColumn[]) {
  const rows = columns.map((column) => {
    const title = column.technique?.title ?? "No technique selected";
    const direction = column.direction ? DIRECTION_LABELS[column.direction] : "No direction";
    const howTo = column.technique?.howTo?.length ? `\nHow to:\n${column.technique.howTo.map((step) => `- ${step}`).join("\n")}` : "";
    const variations = ["A", "B", "C"]
      .map((label, index) => `${label}: ${column.variationValues[index]?.trim() || "No variation written yet."}`)
      .join("\n");

    return `${column.position}. ${title} (${direction})\n${column.technique?.text ?? ""}${howTo}\n${variations}`;
  });

  return `JBR2 Custom protocol\nCustom breathwork protocols made easy\n\n${rows.join("\n\n")}`;
}

function buildHtmlProtocol(columns: PrintableProtocolColumn[]) {
  const headerCells = columns
    .map((column) => {
      const title = escapeHtml(column.technique?.title ?? "No technique selected");
      const direction = escapeHtml(column.direction ? DIRECTION_LABELS[column.direction] : "No direction");
      const text = escapeHtml(column.technique?.text ?? "Choose a technique before printing the protocol.");
      const howTo = column.technique?.howTo?.length
        ? `<div style="margin-top:8px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#607169;">How to</div><ol style="margin:4px 0 0 18px;padding:0;">${column.technique.howTo
            .map((step) => `<li>${escapeHtml(step)}</li>`)
            .join("")}</ol>`
        : "";

      return `<td style="vertical-align:top;border:1px solid #d8d0bf;padding:12px;width:33.33%;"><div style="font-size:22px;font-weight:700;">${column.position}.</div><div style="margin:4px 0 8px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#607169;">${direction}</div><h3 style="margin:0 0 8px;font-size:16px;">${title}</h3><p style="margin:0;color:#607169;">${text}</p>${howTo}</td>`;
    })
    .join("");

  const variationRows = ["A", "B", "C"]
    .map((label, variationIndex) => {
      const cells = columns
        .map((column) => {
          const dimension =
            variationIndex === 0 && column.variationDimension
              ? `<div style="margin-bottom:5px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#607169;">${escapeHtml(column.variationDimension.title)}</div>`
              : "";
          const value = escapeHtml(column.variationValues[variationIndex]?.trim() || "No variation written yet.");

          return `<td style="vertical-align:top;border:1px solid #d8d0bf;padding:10px;width:33.33%;"><div style="font-weight:700;margin-bottom:5px;">${label}</div>${dimension}<p style="margin:0;color:#24352f;">${value}</p></td>`;
        })
        .join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<div style="font-family:Manrope,Avenir Next,Segoe UI,sans-serif;color:#24352f;"><h2 style="margin:0 0 4px;">JBR2 Custom protocol</h2><div style="margin-bottom:14px;color:#607169;">Custom breathwork protocols made easy</div><table style="border-collapse:collapse;width:100%;table-layout:fixed;"><tr>${headerCells}</tr>${variationRows}</table></div>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function uniqueNumbers(values: number[]) {
  return [...new Set(values)];
}

function ProtocolSuggestionCard({
  protocol,
  techniquesById,
  onApplyProtocol,
  onApplyTechniqueToColumn,
  onRevealInBase,
}: {
  protocol: Technique;
  techniquesById: Record<string, Technique>;
  onApplyProtocol: (protocol: Technique, mode: "full" | "directions") => void;
  onApplyTechniqueToColumn: (index: number, technique: Technique) => void;
  onRevealInBase: (techniqueId: string) => void;
}) {
  return (
    <div className={cn("rounded-[1.25rem] border border-[color:var(--border)]", directionSurfaceClass(protocol.dimensions.direction[0]))}>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Protocol</Badge>
            {protocol.dimensions.response ? <Badge variant="outline">{labelize(protocol.dimensions.response)}</Badge> : null}
            {protocol.dimensions.direction.map((direction) => (
              <DirectionPill key={direction} direction={direction} compact />
            ))}
          </div>
          <h3 className="text-lg font-semibold text-[color:var(--foreground)]">{protocol.title}</h3>
        </div>
        <div className="flex shrink-0 gap-2">
          <IconActionButton label={`Show ${protocol.title} in base`} onClick={() => onRevealInBase(protocol.id)}>
            <Info className="h-4 w-4" />
          </IconActionButton>
          <IconActionButton label="Use column directions" onClick={() => onApplyProtocol(protocol, "directions")}>
            <GitBranchPlus className="h-4 w-4" />
          </IconActionButton>
          <IconActionButton label="Use full protocol" onClick={() => onApplyProtocol(protocol, "full")}>
            <Plus className="h-4 w-4" />
          </IconActionButton>
        </div>
      </div>
      <div className="border-t border-[color:var(--border)] px-4 pb-4 pt-4">
        <div className="grid grid-cols-3 gap-3">
          {protocol.children?.map((childId, index) => {
            const child = techniquesById[childId];
            if (!child) {
              return null;
            }

            return (
              <div
                key={`${childId}-${index}`}
                className={cn(
                  "min-w-0 rounded-[1.25rem] border border-[color:var(--border)] p-3",
                  directionSurfaceClass(child.dimensions.direction[0]),
                )}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <DirectionPill direction={child.dimensions.direction[0]} compact />
                  <div className="flex gap-2">
                    <IconActionButton label={`Show ${child.title} in base`} onClick={() => onRevealInBase(child.id)}>
                      <Info className="h-4 w-4" />
                    </IconActionButton>
                    <IconActionButton label={`Use ${child.title} in column ${index + 1}`} onClick={() => onApplyTechniqueToColumn(index, child)}>
                      <Plus className="h-4 w-4" />
                    </IconActionButton>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-[color:var(--foreground)]">{child.title}</h4>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function IconActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] transition-all hover:scale-105 hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--foreground)]"
    >
      {children}
    </button>
  );
}

function AiSuggestionCard({
  suggestion,
  techniquesById,
  variationById,
  onApply,
  onDiscard,
}: {
  suggestion: AiSuggestion;
  techniquesById: Record<string, Technique>;
  variationById: Record<string, VariationDimension>;
  onApply: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className={cn("rounded-[1.25rem] border border-[color:var(--border)] p-4", directionSurfaceClass(suggestion.overallDirection))}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>AI suggestion</Badge>
            <DirectionPill direction={suggestion.overallDirection} />
          </div>
          <h3 className="text-lg font-semibold text-[color:var(--foreground)]">{suggestion.title}</h3>
          <p className="text-sm text-[color:var(--muted-foreground)]">{suggestion.summary}</p>
          <div className="rounded-[1rem] border border-[color:var(--border)] bg-[color:var(--card)] p-3 text-sm text-[color:var(--muted-foreground)]">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--foreground)]">
              Why this fits
            </div>
            {suggestion.rationale}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={onApply}>Use this protocol</Button>
          <Button variant="outline" onClick={onDiscard}>
            Discard
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {suggestion.phases.map((phase) => {
          const technique = techniquesById[phase.techniqueId];
          const variation = variationById[phase.variationDimensionId];

          return (
            <div
              key={`${suggestion.id}-${phase.position}`}
              className={cn("rounded-[1.25rem] border border-[color:var(--border)] p-3", directionSurfaceClass(phase.direction))}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-[color:var(--foreground)]">{phase.position}.</div>
                <DirectionPill direction={phase.direction} compact />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-semibold text-[color:var(--foreground)]">
                  {technique?.title ?? phase.techniqueId}
                </div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                  {variation?.title ?? phase.variationDimensionId}
                </div>
                <div className="space-y-1 text-sm text-[color:var(--muted-foreground)]">
                  <div><strong>A</strong> {phase.variationA}</div>
                  <div><strong>B</strong> {phase.variationB}</div>
                  <div><strong>C</strong> {phase.variationC}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DirectionSelectChip({
  direction,
  active,
  onClick,
}: {
  direction: Direction;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-2 text-sm font-semibold transition-all cursor-pointer",
        active
          ? "scale-[1.02] border-transparent shadow-sm"
          : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--foreground)]",
        direction === "up" && active && "bg-[color:var(--up-chip)] text-[color:var(--up-chip-fg)]",
        direction === "down" && active && "bg-[color:var(--down-chip)] text-[color:var(--down-chip-fg)]",
        direction === "horizontal" && active && "bg-[color:var(--horizontal-chip)] text-[color:var(--horizontal-chip-fg)]",
        direction === "restorative" && active && "bg-[color:var(--restorative-chip)] text-[color:var(--restorative-chip-fg)]",
        direction === "functional" && active && "bg-[color:var(--functional-chip)] text-[color:var(--functional-chip-fg)]",
      )}
    >
      {DIRECTION_LABELS[direction]}
    </button>
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
