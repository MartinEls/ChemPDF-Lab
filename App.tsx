import React, { useState } from 'react';
import { loadPdf, renderPageToImage } from './services/pdfService';
import FileUpload from './components/FileUpload';
import PagePair from './components/PagePair';
import { PageState } from './types';
import { BookOpen, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const [pages, setPages] = useState<PageState[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setPages([]);
    
    try {
      const pdfDoc = await loadPdf(file);
      const totalPages = pdfDoc.numPages;
      const newPages: PageState[] = [];

      // Limit to first 5 pages for demo performance/cost reasons, or remove limit for prod
      const limit = Math.min(totalPages, 5); 

      for (let i = 1; i <= limit; i++) {
        // Render pages sequentially to avoid browser freeze on heavy PDFs
        const imageData = await renderPageToImage(pdfDoc, i);
        newPages.push({
          pageNumber: i,
          imageData,
          status: 'idle'
        });
      }

      setPages(newPages);
    } catch (e: any) {
      console.error(e);
      setError("Failed to load PDF. Make sure it is a valid file.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePage = (pageNum: number, updates: Partial<PageState>) => {
    setPages(prev => prev.map(p => p.pageNumber === pageNum ? { ...p, ...updates } : p));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
           <div className="flex items-center space-x-3">
             <div className="p-1.5 bg-blue-600 rounded-md">
               <BookOpen className="text-white w-5 h-5" />
             </div>
             <h1 className="text-lg font-semibold text-white tracking-tight">SciParse</h1>
           </div>
           <div className="text-sm text-gray-400">
             Powered by Gemini 3 & 2.5
           </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        
        {!pages.length && !isLoading && (
          <div className="max-w-xl mx-auto mt-20">
             <FileUpload onFileSelect={handleFileSelect} />
             {error && (
                <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md flex items-center space-x-2 text-sm border border-red-200">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
             )}
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center mt-32 space-y-4">
             <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
             <p className="text-gray-500 font-medium">Rasterizing PDF pages...</p>
          </div>
        )}

        {pages.length > 0 && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-end mb-8 border-b border-gray-200 pb-4">
               <div>
                  <h2 className="text-2xl font-semibold text-gray-900">Document Analysis</h2>
                  <p className="text-gray-500 mt-1">Found {pages.length} pages (limited to 5 for demo)</p>
               </div>
               <button 
                 onClick={() => setPages([])}
                 className="text-sm text-gray-600 hover:text-gray-900 font-medium underline"
               >
                 Upload New
               </button>
            </div>

            <div className="w-full">
              {pages.map(page => (
                <PagePair 
                  key={page.pageNumber} 
                  page={page} 
                  onUpdatePage={handleUpdatePage} 
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;