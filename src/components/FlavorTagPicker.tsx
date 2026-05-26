import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";

export const FLAVOR_GROUPS: { label: string; tags: readonly string[] }[] = [
  {
    label: "Cereal & Malt",
    tags: ["Malt", "Cereal", "Biscuit", "Porridge"],
  },
  {
    label: "Fruit",
    tags: ["Citrus", "Apple/Pear", "Stone Fruit", "Tropical", "Berry", "Dried Fruit"],
  },
  {
    label: "Floral & Herbal",
    tags: ["Floral", "Heather", "Hay", "Grassy", "Herbal"],
  },
  {
    label: "Smoke & Peat",
    tags: ["Smoky", "Peaty", "Medicinal", "Coastal", "Earthy"],
  },
  {
    label: "Wood",
    tags: ["Vanilla", "Toasted Oak", "Cedar", "Coconut", "Char"],
  },
  {
    label: "Sweet & Honeyed",
    tags: ["Caramel", "Toffee", "Honey", "Chocolate", "Beeswax"],
  },
  {
    label: "Sherry, Nut & Leather",
    tags: ["Sherry", "Port/Red Wine", "Nutty", "Leather", "Tobacco", "Oily"],
  },
];

// Flat list kept for backward compat — WhiskeyDetail, TasterDetail, SearchDrawer all import this
export const FLAVOR_TAGS: readonly string[] = FLAVOR_GROUPS.flatMap((g) => g.tags);

type FlavorTagPickerProps = {
  selected: string[];
  onChange: (tags: string[]) => void;
  /** Override the top margin of the "Flavor Notes" heading. Defaults to 20. */
  topMargin?: number;
};

export default function FlavorTagPicker({ selected, onChange, topMargin }: FlavorTagPickerProps) {
  const theme = useTheme();

  const toggleTag = (tag: string) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  };

  return (
    <div>
      <Typography
        variant="subtitle1"
        component="h3"
        style={{ display: "block", marginTop: topMargin ?? 20, marginBottom: 14, fontWeight: 700 }}
      >
        Flavor Notes
      </Typography>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {FLAVOR_GROUPS.map((group) => (
          <div key={group.label}>
            {/* Group label */}
            <Typography
              variant="caption"
              sx={{
                display: "block",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "text.primary",
                opacity: 0.5,
                mb: 0.75,
                lineHeight: 1,
              }}
            >
              {group.label}
            </Typography>

            {/* Chips */}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {group.tags.map((tag) => {
                const isSelected = selected.includes(tag);
                return (
                  <Chip
                    key={tag}
                    label={tag}
                    onClick={() => toggleTag(tag)}
                    variant={isSelected ? "filled" : "outlined"}
                    color={isSelected ? "primary" : "default"}
                    size="small"
                    clickable
                    sx={{
                      borderColor: isSelected
                        ? undefined
                        : theme.palette.divider,
                    }}
                  />
                );
              })}
            </Box>
          </div>
        ))}
      </div>
    </div>
  );
}
