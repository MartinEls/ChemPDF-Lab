// Access the globally loaded PDF.js
const getPdfLib = () => (window as any).pdfjsLib;

export const loadPdf = async (file: File) => {
  const lib = getPdfLib();
  if (!lib) throw new Error("PDF.js not loaded");

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = lib.getDocument({ data: arrayBuffer });
  return await loadingTask.promise;
};

export const renderPageToImage = async (pdfDoc: any, pageNum: number): Promise<string> => {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2.0 }); // High res for OCR
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  if (!context) throw new Error("Canvas context not available");

  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;

  // Return base64 string without prefix for Gemini, but we add prefix later for Display if needed
  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.split(',')[1]; // Remove "data:image/png;base64," header for API
};

export const cropImage = (base64Image: string, box: number[], originalWidth: number = 1000, originalHeight: number = 1000): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Normalized coordinates [ymin, xmin, ymax, xmax] mapped to 1000x1000 usually
      // But Gemini returns 0-1000 integer space usually.
      // Box: [ymin, xmin, ymax, xmax]
      
      const [ymin, xmin, ymax, xmax] = box;
      
      const sourceX = (xmin / originalWidth) * img.width;
      const sourceY = (ymin / originalHeight) * img.height;
      const sourceW = ((xmax - xmin) / originalWidth) * img.width;
      const sourceH = ((ymax - ymin) / originalHeight) * img.height;

      canvas.width = sourceW;
      canvas.height = sourceH;

      ctx?.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);
      const data = canvas.toDataURL('image/png');
      resolve(data.split(',')[1]);
    };
    img.src = `data:image/png;base64,${base64Image}`;
  });
};
