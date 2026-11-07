// Professional SVG icons for SeBook (Lucide). No emoji is used anywhere
// in the interface.
import {
  BookOpen, Sparkles, Feather, Library, Shapes, User, Castle, Search,
  Heart, Sprout, Clapperboard, NotebookPen
} from "lucide-react";

export const TYPE_ICONS = {
  BookOpen, Sparkles, Feather, Library, Shapes, User, Castle, Search,
  Heart, Sprout, Clapperboard, NotebookPen
};

export function TypeIcon({ name, size = 20, className }) {
  const Icon = TYPE_ICONS[name] || BookOpen;
  return <Icon size={size} className={className} />;
}
