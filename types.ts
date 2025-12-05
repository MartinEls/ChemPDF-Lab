export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  label: string;
}

export interface ExtractedPageContent {
  markdown: string;
  figures: BoundingBox[];
}

export interface PageState {
  pageNumber: number;
  imageData: string; // Base64 png
  status: 'idle' | 'processing' | 'done' | 'error';
  content?: ExtractedPageContent;
  smilesData?: { [key: string]: string }; // id -> SMILES
  isAnalyzingChem?: boolean;
}

export interface ChemicalExtractionResult {
  smiles: string;
  confidence: string;
}
