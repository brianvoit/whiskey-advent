import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import Drawer from "@mui/material/Drawer";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import StarBorderRoundedIcon from "@mui/icons-material/StarBorderRounded";
import { loadSearchIndex, type SearchEntry } from "../api/search";
import { FLAVOR_TAGS } from "./FlavorTagPicker";

const VALID_TAGS = new Set<string>(FLAVOR_TAGS);

const SLIDER_DIMS = [
  { key: "sweetness", label: "Sweet" },
  { key: "fruit",     label: "Fruit" },
  { key: "spice",     label: "Spice" },
  { key: "smoke",     label: "Smoke" },
  { key: "oak",       label: "Oak" },
  { key: "body",      label: "Body" },
] as const;

type FlavorLevel = "low" | "any" | "high";
type DimKey = (typeof SLIDER_DIMS)[number]["key"];

type SearchFilters = {
  years: number[];
  types: string[];
  countries: string[];
  minRating: number;
  flavorLevels: Record<DimKey, FlavorLevel>;
  selectedTags: string[];
};

const defaultFlavorLevels: Record<DimKey, FlavorLevel> = {
  sweetness: "any", fruit: "any", spice: "any",
  smoke: "any", oak: "any", body: "any",
};

const defaultFilters: SearchFilters = {
  years: [], types: [], countries: [],
  minRating: 0,
  flavorLevels: { ...defaultFlavorLevels },
  selectedTags: [],
};

function scoreEntry(
  entry: SearchEntry,
  query: string,
  filters: SearchFilters
): number | null {
  // Hard filters
  if (filters.years.length > 0 && !filters.years.includes(entry.season_year)) return null;
  if (filters.types.length > 0 && (!entry.type || !filters.types.includes(entry.type))) return null;
  if (filters.countries.length > 0 && (!entry.country || !filters.countries.includes(entry.country))) return null;
  if (filters.minRating > 0 && entry.rating < filters.minRating) return null;

  const q = query.trim().toLowerCase();
  const name = entry.name.toLowerCase();
  if (q && !name.includes(q)) return null;

  let score = 0;

  // Text quality
  if (q) {
    score += name.startsWith(q) ? 30 : 15;
  }

  // Tag matches
  const entryTags = new Set((entry.tags ?? []).filter((t) => VALID_TAGS.has(t)));
  for (const tag of filters.selectedTags) {
    if (entryTags.has(tag)) score += 15;
  }

  // Flavor level scoring against group averages
  for (const { key } of SLIDER_DIMS) {
    const level = filters.flavorLevels[key];
    if (level === "any") continue;
    const val = entry.groupSliders[key];
    if (val === null) continue;
    if (level === "high") {
      score += val >= 4 ? 20 : val >= 3 ? 10 : 0;
    } else {
      score += val <= 2 ? 20 : val <= 3 ? 10 : 0;
    }
  }

  return score;
}

type SearchDrawerProps = {
  open: boolean;
  onClose: () => void;
  userId: string;
  availableYears: number[];
  tastingMode: string;
};

export default function SearchDrawer({
  open,
  onClose,
  userId,
  availableYears,
  tastingMode,
}: SearchDrawerProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [index, setIndex] = useState<SearchEntry[]>([]);
  const [indexLoading, setIndexLoading] = useState(false);
  const indexLoaded = useRef(false);

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [flavorOpen, setFlavorOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load index once on first open
  useEffect(() => {
    if (!open || indexLoaded.current) return;
    indexLoaded.current = true;
    setIndexLoading(true);
    loadSearchIndex(userId, availableYears, tastingMode).then((entries) => {
      setIndex(entries);
      setIndexLoading(false);
    });
  }, [open, userId, availableYears, tastingMode]);

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Escape key closes on desktop
  useEffect(() => {
    if (!open || isMobile) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, isMobile, onClose]);

  // Derived filter options from index
  const typeOptions = useMemo(
    () => [...new Set(index.map((e) => e.type).filter(Boolean))].sort() as string[],
    [index]
  );
  const countryOptions = useMemo(
    () => [...new Set(index.map((e) => e.country).filter(Boolean))].sort() as string[],
    [index]
  );
  const tagOptions = useMemo(
    () =>
      FLAVOR_TAGS.filter((tag) =>
        index.some((e) => e.tags?.includes(tag))
      ),
    [index]
  );

  // Whether the user has entered any search input at all
  const hasInput =
    query.trim().length > 0 ||
    filters.years.length > 0 ||
    filters.types.length > 0 ||
    filters.countries.length > 0 ||
    filters.minRating > 0 ||
    filters.selectedTags.length > 0 ||
    Object.values(filters.flavorLevels).some((v) => v !== "any");

  // Scored + sorted results — empty until the user starts searching
  const results = useMemo(() => {
    if (!hasInput) return [];
    return index
      .map((e) => ({ entry: e, score: scoreEntry(e, query, filters) }))
      .filter((r): r is { entry: SearchEntry; score: number } => r.score !== null)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.entry.rating - a.entry.rating;
      })
      .map((r) => r.entry);
  }, [index, query, filters, hasInput]);

  // Active filter summary chips
  const activeFilterLabels: { label: string; clear: () => void }[] = useMemo(() => {
    const out: { label: string; clear: () => void }[] = [];
    for (const y of filters.years) {
      out.push({ label: String(y), clear: () => setFilters((f) => ({ ...f, years: f.years.filter((v) => v !== y) })) });
    }
    for (const t of filters.types) {
      out.push({ label: t, clear: () => setFilters((f) => ({ ...f, types: f.types.filter((v) => v !== t) })) });
    }
    for (const c of filters.countries) {
      out.push({ label: c, clear: () => setFilters((f) => ({ ...f, countries: f.countries.filter((v) => v !== c) })) });
    }
    if (filters.minRating > 0) {
      out.push({ label: `★ ${filters.minRating}+`, clear: () => setFilters((f) => ({ ...f, minRating: 0 })) });
    }
    for (const { key, label } of SLIDER_DIMS) {
      const level = filters.flavorLevels[key];
      if (level !== "any") {
        const lbl = `${label}: ${level === "high" ? "High" : "Low"}`;
        out.push({ label: lbl, clear: () => setFilters((f) => ({ ...f, flavorLevels: { ...f.flavorLevels, [key]: "any" } })) });
      }
    }
    for (const tag of filters.selectedTags) {
      out.push({ label: tag, clear: () => setFilters((f) => ({ ...f, selectedTags: f.selectedTags.filter((v) => v !== tag) })) });
    }
    return out;
  }, [filters]);

  const handleClose = () => {
    onClose();
    // Reset state after close animation
    setTimeout(() => {
      setQuery("");
      setFilters(defaultFilters);
      setFiltersOpen(false);
      setFlavorOpen(false);
    }, 300);
  };

  const content = (
    <SearchContent
      query={query}
      setQuery={setQuery}
      filters={filters}
      setFilters={setFilters}
      filtersOpen={filtersOpen}
      setFiltersOpen={setFiltersOpen}
      flavorOpen={flavorOpen}
      setFlavorOpen={setFlavorOpen}
      activeFilterLabels={activeFilterLabels}
      results={results}
      indexLoading={indexLoading}
      availableYears={availableYears}
      typeOptions={typeOptions}
      countryOptions={countryOptions}
      tagOptions={tagOptions}
      indexSize={index.length}
      hasInput={hasInput}
      onClose={handleClose}
      inputRef={inputRef}
    />
  );

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={handleClose}
        PaperProps={{
          style: {
            borderRadius: "16px 16px 0 0",
            maxHeight: "85vh",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        {content}
      </Drawer>
    );
  }

  // Desktop: always rendered — slides out from behind the header (header zIndex: 100, panel: 99)
  return (
    <>
      {/* Backdrop — fades in behind panel, above page content */}
      <div
        onClick={open ? handleClose : undefined}
        style={{
          position: "fixed",
          top: 68,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 95,
          background: "rgba(0,0,0,0.35)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
      />
      {/* Panel — sits just below the header; translateY(-100%) tucks it back behind the nav */}
      <div
        style={{
          position: "fixed",
          top: 68,
          left: 0,
          right: 0,
          zIndex: 99,
          maxHeight: "calc(100vh - 68px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          backgroundColor: theme.palette.background.paper,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          borderBottom: `1px solid ${theme.palette.divider}`,
          transform: open ? "translateY(0)" : "translateY(-100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {content}
      </div>
    </>
  );
}

// ── Shared panel content ───────────────────────────────────────────────────────

type SearchContentProps = {
  query: string;
  setQuery: (q: string) => void;
  filters: SearchFilters;
  setFilters: (fn: (f: SearchFilters) => SearchFilters) => void;
  filtersOpen: boolean;
  setFiltersOpen: (v: boolean) => void;
  flavorOpen: boolean;
  setFlavorOpen: (v: boolean) => void;
  activeFilterLabels: { label: string; clear: () => void }[];
  results: SearchEntry[];
  indexLoading: boolean;
  availableYears: number[];
  typeOptions: string[];
  countryOptions: string[];
  tagOptions: readonly string[];
  indexSize: number;
  hasInput: boolean;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
};

function SearchContent({
  query, setQuery, filters, setFilters,
  filtersOpen, setFiltersOpen, flavorOpen, setFlavorOpen,
  activeFilterLabels, results, indexLoading, indexSize, hasInput,
  availableYears, typeOptions, countryOptions, tagOptions,
  onClose, inputRef,
}: SearchContentProps) {
  const theme = useTheme();
  const navigate = useNavigate();

  const hasActiveFilters = activeFilterLabels.length > 0;
  const isMd = useMediaQuery(theme.breakpoints.up("md"));

  const toggleYear = (y: number) =>
    setFilters((f) => ({
      ...f,
      years: f.years.includes(y) ? f.years.filter((v) => v !== y) : [...f.years, y],
    }));
  const toggleType = (t: string) =>
    setFilters((f) => ({
      ...f,
      types: f.types.includes(t) ? f.types.filter((v) => v !== t) : [...f.types, t],
    }));
  const toggleCountry = (c: string) =>
    setFilters((f) => ({
      ...f,
      countries: f.countries.includes(c) ? f.countries.filter((v) => v !== c) : [...f.countries, c],
    }));
  const toggleTag = (tag: string) =>
    setFilters((f) => ({
      ...f,
      selectedTags: f.selectedTags.includes(tag)
        ? f.selectedTags.filter((v) => v !== tag)
        : [...f.selectedTags, tag],
    }));
  const setFlavorLevel = (key: DimKey, level: FlavorLevel) =>
    setFilters((f) => ({
      ...f,
      flavorLevels: { ...f.flavorLevels, [key]: level },
    }));

  return (
    <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", flex: 1 }}>
      {/* Search input row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          borderBottom: `1px solid ${theme.palette.divider}`,
          flexShrink: 0,
          maxWidth: isMd ? 900 : undefined,
          width: "100%",
          alignSelf: "center",
          boxSizing: "border-box",
        }}
      >
        <SearchRoundedIcon style={{ color: theme.palette.text.secondary, flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search whiskies…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: "1rem",
            background: "transparent",
            color: theme.palette.text.primary,
          }}
        />
        <button
          type="button"
          onClick={onClose}
          style={{
            border: "none",
            background: "none",
            cursor: "pointer",
            padding: 4,
            display: "flex",
            alignItems: "center",
            color: theme.palette.text.secondary,
            flexShrink: 0,
          }}
          aria-label="Close search"
        >
          <CloseRoundedIcon fontSize="small" />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: isMd ? 900 : undefined, margin: "0 auto" }}>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                padding: "10px 16px 0",
              }}
            >
              {activeFilterLabels.map(({ label, clear }) => (
                <Chip
                  key={label}
                  label={label}
                  size="small"
                  color="primary"
                  variant="filled"
                  onDelete={clear}
                  style={{ fontSize: "0.78rem" }}
                />
              ))}
            </div>
          )}

          {/* Filter panel toggle */}
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              width: "100%",
              padding: "10px 16px",
              border: "none",
              background: "none",
              cursor: "pointer",
              color: theme.palette.text.secondary,
              fontSize: "0.85rem",
              fontWeight: 600,
              textAlign: "left",
            }}
          >
            {filtersOpen ? <ExpandLessRoundedIcon fontSize="small" /> : <ExpandMoreRoundedIcon fontSize="small" />}
            Filters
          </button>

          {filtersOpen && (
            <div
              style={{
                padding: "0 16px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
                borderBottom: `1px solid ${theme.palette.divider}`,
              }}
            >
              {/* Year */}
              <FilterRow label="Year">
                {availableYears.map((y) => (
                  <Chip
                    key={y}
                    label={String(y)}
                    size="small"
                    variant={filters.years.includes(y) ? "filled" : "outlined"}
                    color={filters.years.includes(y) ? "primary" : "default"}
                    onClick={() => toggleYear(y)}
                    style={{ cursor: "pointer" }}
                  />
                ))}
              </FilterRow>

              {/* Type */}
              {typeOptions.length > 0 && (
                <FilterRow label="Type">
                  {typeOptions.map((t) => (
                    <Chip
                      key={t}
                      label={t}
                      size="small"
                      variant={filters.types.includes(t) ? "filled" : "outlined"}
                      color={filters.types.includes(t) ? "primary" : "default"}
                      onClick={() => toggleType(t)}
                      style={{ cursor: "pointer" }}
                    />
                  ))}
                </FilterRow>
              )}

              {/* Country */}
              {countryOptions.length > 0 && (
                <FilterRow label="Country">
                  {countryOptions.map((c) => (
                    <Chip
                      key={c}
                      label={c}
                      size="small"
                      variant={filters.countries.includes(c) ? "filled" : "outlined"}
                      color={filters.countries.includes(c) ? "primary" : "default"}
                      onClick={() => toggleCountry(c)}
                      style={{ cursor: "pointer" }}
                    />
                  ))}
                </FilterRow>
              )}

              {/* Min rating */}
              <FilterRow label="Min ★">
                <div style={{ display: "flex", gap: 4 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() =>
                        setFilters((f) => ({
                          ...f,
                          minRating: f.minRating === star ? 0 : star,
                        }))
                      }
                      style={{
                        border: "none",
                        background: "none",
                        padding: 0,
                        cursor: "pointer",
                        display: "flex",
                        color: star <= filters.minRating
                          ? theme.palette.primary.main
                          : theme.palette.action.disabled,
                      }}
                    >
                      {star <= filters.minRating ? (
                        <StarRoundedIcon style={{ fontSize: "1.3rem" }} />
                      ) : (
                        <StarBorderRoundedIcon style={{ fontSize: "1.3rem" }} />
                      )}
                    </button>
                  ))}
                </div>
              </FilterRow>

              {/* Flavor (collapsible) */}
              <div>
                <button
                  type="button"
                  onClick={() => setFlavorOpen(!flavorOpen)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: theme.palette.text.secondary,
                    padding: 0,
                    marginBottom: flavorOpen ? 10 : 0,
                  }}
                >
                  {flavorOpen ? <ExpandLessRoundedIcon fontSize="small" /> : <ExpandMoreRoundedIcon fontSize="small" />}
                  Flavor profile
                </button>
                {flavorOpen && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {SLIDER_DIMS.map(({ key, label }) => (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          style={{ width: 44, flexShrink: 0, fontSize: "0.82rem" }}
                        >
                          {label}
                        </Typography>
                        <div style={{ display: "flex", gap: 4 }}>
                          {(["low", "any", "high"] as FlavorLevel[]).map((level) => (
                            <button
                              key={level}
                              type="button"
                              onClick={() => setFlavorLevel(key, level)}
                              style={{
                                padding: "3px 10px",
                                border: `1px solid ${
                                  filters.flavorLevels[key] === level
                                    ? theme.palette.primary.main
                                    : theme.palette.divider
                                }`,
                                borderRadius: 999,
                                background:
                                  filters.flavorLevels[key] === level
                                    ? theme.palette.primary.main
                                    : "transparent",
                                color:
                                  filters.flavorLevels[key] === level
                                    ? theme.palette.primary.contrastText
                                    : theme.palette.text.secondary,
                                fontSize: "0.78rem",
                                fontWeight: 500,
                                cursor: "pointer",
                                textTransform: "capitalize",
                              }}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags */}
              {tagOptions.length > 0 && (
                <FilterRow label="Tags">
                  {tagOptions.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      variant={filters.selectedTags.includes(tag) ? "filled" : "outlined"}
                      color={filters.selectedTags.includes(tag) ? "primary" : "default"}
                      onClick={() => toggleTag(tag)}
                      style={{ cursor: "pointer" }}
                    />
                  ))}
                </FilterRow>
              )}
            </div>
          )}

          {/* Results */}
          <div style={{ padding: "8px 0" }}>
            {indexLoading ? (
              <Typography variant="body2" color="text.secondary" style={{ padding: "16px 16px" }}>
                Loading…
              </Typography>
            ) : !hasInput ? (
              <Typography variant="body2" color="text.secondary" style={{ padding: "16px 16px" }}>
                Type a name or choose filters to find whiskies.
              </Typography>
            ) : results.length === 0 ? (
              <Typography variant="body2" color="text.secondary" style={{ padding: "16px 16px" }}>
                {indexSize === 0 ? "No rated whiskies found." : "No matches for these filters."}
              </Typography>
            ) : (
              results.map((entry) => {
                const validEntryTags = (entry.tags ?? []).filter((t) => VALID_TAGS.has(t));
                const selectedTagSet = new Set(filters.selectedTags);

                return (
                  <button
                    key={entry.whiskey_day_id}
                    type="button"
                    onClick={() => {
                      navigate(`/whiskey/${entry.whiskey_day_id}`);
                      onClose();
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 5,
                      width: "100%",
                      padding: "10px 16px",
                      border: "none",
                      borderTop: `1px solid ${theme.palette.divider}`,
                      background: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                        theme.palette.action.hover;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = "";
                    }}
                  >
                    {/* Name row + year badge + rating */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Typography
                        variant="subtitle2"
                        style={{
                          flex: 1,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: theme.palette.text.primary,
                        }}
                      >
                        {entry.name}
                      </Typography>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                          color: theme.palette.text.disabled,
                          flexShrink: 0,
                        }}
                      >
                        {entry.season_year}
                      </span>
                      <span
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          color: theme.palette.primary.main,
                          fontVariantNumeric: "tabular-nums",
                          flexShrink: 0,
                        }}
                      >
                        ★ {entry.rating.toFixed(1)}
                      </span>
                    </div>

                    {/* Flavor tags */}
                    {validEntryTags.length > 0 && (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {validEntryTags.map((tag) => {
                          const isMatch = selectedTagSet.has(tag);
                          return (
                            <Chip
                              key={tag}
                              label={tag}
                              size="small"
                              variant={isMatch ? "filled" : "outlined"}
                              color={isMatch ? "primary" : "default"}
                              style={{ fontSize: "0.7rem", height: 20, pointerEvents: "none" }}
                            />
                          );
                        })}
                      </Box>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        style={{ width: 56, flexShrink: 0, paddingTop: 4, fontSize: "0.78rem" }}
      >
        {label}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
        {children}
      </Box>
    </div>
  );
}
