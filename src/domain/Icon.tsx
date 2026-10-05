import React from 'react';
import {
  FileText,
  Zap,
  Target,
  Lightbulb,
  Terminal,
  Bookmark,
  Folder,
  Star,
  Compass,
  Layers,
  Box,
  Feather,
  CheckCircle2,
  Calendar,
  Coffee,
  Hash,
  Shield,
  Activity,
  Code,
  Sparkles,
  BookOpen,
  type LucideIcon
} from 'lucide-react';

export const ICON_MAP: Record<string, LucideIcon> = {
  'file-text': FileText,
  'zap': Zap,
  'target': Target,
  'lightbulb': Lightbulb,
  'terminal': Terminal,
  'bookmark': Bookmark,
  'folder': Folder,
  'star': Star,
  'compass': Compass,
  'layers': Layers,
  'box': Box,
  'feather': Feather,
  'check-circle': CheckCircle2,
  'calendar': Calendar,
  'coffee': Coffee,
  'hash': Hash,
  'shield': Shield,
  'activity': Activity,
  'code': Code,
  'sparkles': Sparkles,
  'book-open': BookOpen
};

// Seamless fallback for older notes containing legacy emojis
export const EMOJI_TO_ICON: Record<string, string> = {
  '📝': 'file-text',
  '🚀': 'zap',
  '🎯': 'target',
  '💡': 'lightbulb',
  '💻': 'terminal',
  '📌': 'bookmark',
  '📂': 'folder',
  '✨': 'star',
  '🧭': 'compass',
  '🌿': 'feather',
  '☕': 'coffee',
  '📅': 'calendar',
  '🏷️': 'hash',
  '🔑': 'shield',
  '⚡': 'zap',
  '🧠': 'activity'
};

interface AppIconProps {
  name: string;
  size?: number;
  className?: string;
}

export const AppIcon: React.FC<AppIconProps> = ({ name, size = 16, className = '' }) => {
  const normalizedKey = EMOJI_TO_ICON[name] || name;
  const IconComponent = ICON_MAP[normalizedKey] || FileText;

  return <IconComponent size={size} className={className} strokeWidth={2} />;
};

export const AVAILABLE_ICON_KEYS = Object.keys(ICON_MAP);
