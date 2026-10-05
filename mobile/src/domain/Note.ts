export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'todo'
  | 'bullet'
  | 'numbered'
  | 'quote'
  | 'callout'
  | 'code'
  | 'divider';

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  calloutIcon?: string;
  order: number;
  updatedAt: string;
}

export type CoverStyle = 'charcoal-mesh' | 'mono-grid' | 'slate-gradient' | 'minimal-dots';

export interface Note {
  id: string;
  title: string;
  icon: string;
  hasCover: boolean;
  coverStyle?: CoverStyle;
  blocks: Block[];
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  version?: number;
}
