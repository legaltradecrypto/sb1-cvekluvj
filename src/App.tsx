import React, { useState, useRef, useCallback } from 'react';
import { Download, Plus, X, ExternalLink, FileImage, FileVideo, Copy, Check, Trash2, Eye, Clock } from 'lucide-react';

interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  filename: string;
  size?: string;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  progress?: number;
  downloadUrl?: string;
}

interface DownloadHistory {
  id: string;
  filename: string;
  url: string;
  type: 'image' | 'video';
  downloadedAt: Date;
}

function App() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadHistory, setDownloadHistory] = useState<DownloadHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileExtension = (url: string): string => {
    const path = new URL(url).pathname;
    return path.split('.').pop()?.toLowerCase() || '';
  };

  const getMediaType = (url: string): 'image' | 'video' => {
    const ext = getFileExtension(url);
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    const videoExts = ['mp4', 'webm', 'avi', 'mov', 'wmv', 'flv', 'mkv'];
    
    if (imageExts.includes(ext)) return 'image';
    if (videoExts.includes(ext)) return 'video';
    
    // Default to image if uncertain
    return 'image';
  };

  const generateFilename = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      const filename = path.split('/').pop() || 'download';
      return filename.includes('.') ? filename : `${filename}.${getFileExtension(url)}`;
    } catch {
      return `download_${Date.now()}.${getFileExtension(url)}`;
    }
  };

  const addMediaItem = useCallback((url: string) => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl || mediaItems.some(item => item.url === trimmedUrl)) return;

    const newItem: MediaItem = {
      id: Date.now().toString(),
      url: trimmedUrl,
      type: getMediaType(trimmedUrl),
      filename: generateFilename(trimmedUrl),
      status: 'pending'
    };

    setMediaItems(prev => [...prev, newItem]);
  }, [mediaItems]);

  const removeMediaItem = (id: string) => {
    setMediaItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      addMediaItem(urlInput);
      setUrlInput('');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const text = e.dataTransfer.getData('text');
    if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
      addMediaItem(text);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        addMediaItem(text);
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(text);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const downloadFile = async (item: MediaItem) => {
    setMediaItems(prev => prev.map(i => 
      i.id === item.id ? { ...i, status: 'downloading', progress: 0 } : i
    ));

    try {
      const response = await fetch(item.url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const reader = response.body?.getReader();
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      let received = 0;
      const chunks: Uint8Array[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          chunks.push(value);
          received += value.length;
          
          if (total > 0) {
            const progress = (received / total) * 100;
            setMediaItems(prev => prev.map(i => 
              i.id === item.id ? { ...i, progress } : i
            ));
          }
        }
      }

      const blob = new Blob(chunks);
      const downloadUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = item.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(downloadUrl);

      setMediaItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, status: 'completed', progress: 100 } : i
      ));

      // Add to history
      const historyItem: DownloadHistory = {
        id: Date.now().toString(),
        filename: item.filename,
        url: item.url,
        type: item.type,
        downloadedAt: new Date()
      };
      setDownloadHistory(prev => [historyItem, ...prev.slice(0, 49)]); // Keep last 50 items

    } catch (error) {
      console.error('Download failed:', error);
      setMediaItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, status: 'error' } : i
      ));
    }
  };

  const downloadAll = async () => {
    const pendingItems = mediaItems.filter(item => item.status === 'pending');
    for (const item of pendingItems) {
      await downloadFile(item);
      // Small delay between downloads to prevent overwhelming the browser
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const clearCompleted = () => {
    setMediaItems(prev => prev.filter(item => item.status !== 'completed'));
  };

  const clearHistory = () => {
    setDownloadHistory([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Download className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">MediaDrop</h1>
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Clock className="w-5 h-5" />
              <span>History</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* URL Input Form */}
        <div className="mb-8">
          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <div
              className={`relative bg-white rounded-2xl shadow-lg border-2 transition-all duration-300 ${
                dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="p-6">
                <label htmlFor="url-input" className="block text-sm font-medium text-gray-700 mb-2">
                  Media URL
                </label>
                <div className="flex space-x-3">
                  <input
                    id="url-input"
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/image.jpg or https://example.com/video.mp4"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="px-4 py-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                    title="Paste from clipboard"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                  <button
                    type="submit"
                    disabled={!urlInput.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add</span>
                  </button>
                </div>
                {dragActive && (
                  <div className="absolute inset-0 bg-blue-50/80 border-2 border-dashed border-blue-400 rounded-2xl flex items-center justify-center">
                    <p className="text-blue-600 font-medium">Drop URL here</p>
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Media Items */}
        {mediaItems.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Download Queue</h2>
              <div className="flex space-x-3">
                <button
                  onClick={clearCompleted}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear Completed</span>
                </button>
                <button
                  onClick={downloadAll}
                  disabled={!mediaItems.some(item => item.status === 'pending')}
                  className="px-6 py-2 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-lg hover:from-green-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download All</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mediaItems.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
                  <div className="aspect-video bg-gray-100 relative overflow-hidden">
                    {item.type === 'image' ? (
                      <img
                        src={item.url}
                        alt={item.filename}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.style.display = 'none';
                        }}
                      />
                    ) : (
                      <video
                        src={item.url}
                        className="w-full h-full object-cover"
                        muted
                        preload="metadata"
                        onError={(e) => {
                          const video = e.target as HTMLVideoElement;
                          video.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="absolute top-3 right-3">
                      {item.type === 'image' ? (
                        <FileImage className="w-6 h-6 text-white bg-black/50 rounded p-1" />
                      ) : (
                        <FileVideo className="w-6 h-6 text-white bg-black/50 rounded p-1" />
                      )}
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <h3 className="font-medium text-gray-900 truncate mb-2">{item.filename}</h3>
                    
                    {item.status === 'downloading' && (
                      <div className="mb-3">
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span>Downloading...</span>
                          <span>{Math.round(item.progress || 0)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${item.progress || 0}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => copyToClipboard(item.url)}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Copy URL"
                        >
                          {copiedUrl === item.url ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      
                      <div className="flex space-x-2">
                        {item.status === 'pending' && (
                          <button
                            onClick={() => downloadFile(item)}
                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center space-x-1"
                          >
                            <Download className="w-4 h-4" />
                            <span>Download</span>
                          </button>
                        )}
                        {item.status === 'completed' && (
                          <span className="px-4 py-2 bg-green-100 text-green-800 rounded-lg text-sm font-medium">
                            Completed
                          </span>
                        )}
                        {item.status === 'error' && (
                          <span className="px-4 py-2 bg-red-100 text-red-800 rounded-lg text-sm font-medium">
                            Error
                          </span>
                        )}
                        <button
                          onClick={() => removeMediaItem(item.id)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Download History */}
        {showHistory && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Download History</h2>
              {downloadHistory.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear History</span>
                </button>
              )}
            </div>

            {downloadHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No downloads yet</p>
            ) : (
              <div className="space-y-3">
                {downloadHistory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-3">
                      {item.type === 'image' ? (
                        <FileImage className="w-5 h-5 text-gray-500" />
                      ) : (
                        <FileVideo className="w-5 h-5 text-gray-500" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{item.filename}</p>
                        <p className="text-sm text-gray-500">{item.downloadedAt.toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(item.url)}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      {copiedUrl === item.url ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {mediaItems.length === 0 && (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Download className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Start Downloading Media</h2>
            <p className="text-gray-600 mb-6">Add URLs to download images and videos from the web</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <div className="flex items-center space-x-2 text-gray-500">
                <FileImage className="w-5 h-5" />
                <span>Supports: JPG, PNG, GIF, WebP, SVG</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-500">
                <FileVideo className="w-5 h-5" />
                <span>Supports: MP4, WebM, AVI, MOV</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
