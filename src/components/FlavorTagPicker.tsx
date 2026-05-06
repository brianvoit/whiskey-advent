import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export const FLAVOR_TAGS = [
  // Sweet / dessert
  "Vanilla", "Caramel", "Honey", "Chocolate", "Toffee",
  // Fruit
  "Fruity", "Citrus", "Apple", "Dried Fruit",
  // Grain / cereal
  "Cereal", "Malty",
  // Smoke / earth
  "Smoky", "Peaty", "Medicinal", "Coastal",
  // Spice / wood
  "Spicy", "Oak", "Leather", "Herbal",
  // Other
  "Nutty", "Floral", "Creamy",
] as const;

type FlavorTagPickerProps = {
  selected: string[];
  onChange: (tags: string[]) => void;
};

export default function FlavorTagPicker({ selected, onChange }: FlavorTagPickerProps) {
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
        variant="subtitle2"
        component="label"
        style={{ display: "block", marginTop: 24, marginBottom: 8 }}
      >
        Flavor Notes
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {FLAVOR_TAGS.map((tag) => {
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
            />
          );
        })}
      </Box>
    </div>
  );
}
