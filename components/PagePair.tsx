import React, { useState } from 'react';
import { PageState, BoundingBox } from '../types';
import { Loader2, Zap, FlaskConical, Check } from 'lucide-react';
import { extractSmilesFromCrop, extractPageContent } from '../services/geminiService';
import { cropImage } from '../services/pdfService';

interface PagePairProps {
  page: PageState;
  onUpdatePage: (pageNum: number, updates: Partial<PageState>) => void;
}

const PagePair: React.FC<PagePairProps> = ({ page, onUpdatePage }) => {
  const [hoveredBoxIndex, setHoveredBoxIndex] = useState<number | null>(null);

  const handleProcess = async () => {
    onUpdatePage(page.pageNumber, { status: 'processing' });
    try {
      const result = await extractPageContent(page.imageData);
      onUpdatePage(page.pageNumber, { status: 'done', content: result });
    } catch (e) {
      onUpdatePage(page.pageNumber, { status: 'error' });
    }
  };

  const handleExtractSmiles = async (box: BoundingBox, index: number) => {
    const boxId = `fig-${index}`;
    // Optimistic update
    const currentSmiles = page.smilesData || {};
    onUpdatePage(page.pageNumber, { 
      isAnalyzingChem: true,
      smilesData: { ...currentSmiles, [boxId]: 'Analyzing...' }
    });

    try {
      // 1. Crop image
      // Gemini 2.5 returns coords in 0-1000 scale usually
      const cropBase64 = await cropImage(
        page.imageData, 
        [box.ymin, box.xmin, box.ymax, box.xmax],
        1000, 1000 
      );

      // 2. Send to Gemini 3
      const result = await extractSmilesFromCrop(cropBase64);
      
      onUpdatePage(page.pageNumber, {
        isAnalyzingChem: false,
        smilesData: { ...currentSmiles, [boxId]: result.smiles }
      });

    } catch (e) {
      onUpdatePage(page.pageNumber, { isAnalyzingChem: false });
    }
  };

  // Convert normalized coords (assuming 1000x1000 from prompt) to percentage
  const getBoxStyle = (box: BoundingBox) => ({
    top: `${(box.ymin / 1000) * 100}%`,
    left: `${(box.xmin / 1000) * 100}%`,
    height: `${((box.ymax - box.ymin) / 1000) * 100}%`,
    width: `${((box.xmax - box.xmin) / 1000) * 100}%`
  });

  return (
    <div className="grid grid-cols-2 gap-6 mb-12 border-b border-gray-200 pb-12 last:border-0">
      {/* Left Pane: PDF Page Image */}
      <div className="flex flex-col space-y-2">
        <div className="flex justify-between items-center text-sm text-gray-500 font-medium px-1">
          <span>Page {page.pageNumber}</span>
          {page.status === 'idle' && (
             <button 
               onClick={handleProcess}
               className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1 rounded-full text-xs transition-colors"
             >
               <Zap size={14} />
               <span>Process Page</span>
             </button>
          )}
          {page.status === 'processing' && (
             <span className="flex items-center space-x-1 text-blue-600 text-xs">
               <Loader2 size={14} className="animate-spin" />
               <span>Analyzing...</span>
             </span>
          )}
          {page.status === 'done' && (
             <span className="flex items-center space-x-1 text-green-600 text-xs">
               <Check size={14} />
               <span>Extracted</span>
             </span>
          )}
        </div>
        
        <div className="relative border border-gray-200 shadow-sm bg-white rounded-md overflow-hidden group">
          <img 
            src={`data:image/png;base64,${page.imageData}`} 
            alt={`Page ${page.pageNumber}`} 
            className="w-full h-auto"
          />
          
          {/* Overlay Bounding Boxes */}
          {page.content?.figures.map((box, idx) => (
            <div
              key={idx}
              className={`absolute border-2 transition-all cursor-pointer flex items-center justify-center ${
                hoveredBoxIndex === idx ? 'border-blue-500 bg-blue-500/10 z-10' : 'border-blue-400/30 hover:border-blue-500'
              }`}
              style={getBoxStyle(box)}
              onMouseEnter={() => setHoveredBoxIndex(idx)}
              onMouseLeave={() => setHoveredBoxIndex(null)}
              title={box.label}
            >
               {/* Quick Action for Chemistry */}
               <button
                  onClick={(e) => { e.stopPropagation(); handleExtractSmiles(box, idx); }}
                  className={`absolute -top-3 -right-3 p-1 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-opacity ${hoveredBoxIndex === idx ? 'opacity-100' : 'opacity-0'}`}
                  title="Convert to SMILES"
               >
                 <FlaskConical size={12} />
               </button>
            </div>
          ))}
        </div>
      </div>

      {/* Right Pane: Markdown Content */}
      <div className="flex flex-col space-y-2">
         <div className="flex justify-between items-center text-sm text-gray-500 font-medium px-1 h-6">
            <span>Extracted Content</span>
         </div>
         
         <div className="bg-white border border-gray-200 shadow-sm rounded-md p-6 h-full min-h-[600px] text-gray-800 text-sm leading-relaxed overflow-auto">
            {page.status === 'idle' && (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                <p>Waiting for analysis...</p>
              </div>
            )}
            
            {page.status === 'processing' && (
               <div className="space-y-4 animate-pulse">
                 <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                 <div className="h-4 bg-gray-100 rounded w-full"></div>
                 <div className="h-4 bg-gray-100 rounded w-5/6"></div>
                 <div className="h-32 bg-gray-50 rounded w-full border border-dashed border-gray-200"></div>
                 <div className="h-4 bg-gray-100 rounded w-full"></div>
               </div>
            )}

            {page.status === 'done' && page.content && (
              <div className="space-y-4">
                 {/* 
                   Simple Markdown Rendering 
                   In a real app, use react-markdown. Here we do simple replacement for demonstration 
                   to keep file count low and avoid complex deps.
                 */}
                 {page.content.markdown.split('\n').map((line, i) => {
                    if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-gray-900 mb-2">{line.replace('# ', '')}</h1>;
                    if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-semibold text-gray-900 mt-4 mb-2">{line.replace('## ', '')}</h2>;
                    if (line.startsWith('### ')) return <h3 key={i} className="text-base font-semibold text-gray-900 mt-2 mb-1">{line.replace('### ', '')}</h3>;
                    if (line.trim().startsWith('- ')) return <li key={i} className="ml-4 list-disc text-gray-700">{line.replace('- ', '')}</li>;
                    if (line.trim() === '') return <br key={i} />;
                    return <p key={i} className="text-gray-700 mb-1">{line}</p>;
                 })}

                 {/* SMILES Results Injection */}
                 {page.content.figures.length > 0 && (
                   <div className="mt-8 pt-4 border-t border-gray-100">
                     <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Detected Figures & Chemistry</h4>
                     <div className="grid grid-cols-1 gap-3">
                        {page.content.figures.map((fig, idx) => {
                           const boxId = `fig-${idx}`;
                           const smile = page.smilesData?.[boxId];
                           return (
                             <div key={idx} className="bg-gray-50 rounded border border-gray-100 p-3 flex items-start space-x-3 hover:border-blue-200 transition-colors"
                                  onMouseEnter={() => setHoveredBoxIndex(idx)}
                                  onMouseLeave={() => setHoveredBoxIndex(null)}
                             >
                               <div className="p-2 bg-white rounded border border-gray-200 text-gray-400">
                                 {smile ? <FlaskConical size={16} className="text-indigo-500"/> : <Zap size={16} />}
                               </div>
                               <div className="flex-1">
                                 <p className="text-xs font-semibold text-gray-700">{fig.label || `Figure ${idx + 1}`}</p>
                                 
                                 {!smile && (
                                   <button 
                                     onClick={() => handleExtractSmiles(fig, idx)}
                                     disabled={page.isAnalyzingChem}
                                     className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center space-x-1"
                                   >
                                     <span>Identify Chemical Structure</span>
                                   </button>
                                 )}

                                 {smile && smile !== 'Analyzing...' && (
                                   <div className="mt-2 bg-indigo-50 p-2 rounded border border-indigo-100 font-mono text-xs text-indigo-900 break-all">
                                     <span className="font-bold text-indigo-400 select-none mr-1">SMILES:</span>
                                     {smile}
                                   </div>
                                 )}
                                 
                                 {smile === 'Analyzing...' && (
                                    <div className="mt-2 text-xs text-gray-500 flex items-center space-x-1">
                                      <Loader2 size={10} className="animate-spin"/>
                                      <span>Gemini 3 Pro thinking...</span>
                                    </div>
                                 )}
                               </div>
                             </div>
                           );
                        })}
                     </div>
                   </div>
                 )}
              </div>
            )}

            {page.status === 'error' && (
              <div className="text-red-500 text-sm">Failed to process page. Try again.</div>
            )}
         </div>
      </div>
    </div>
  );
};

export default PagePair;
