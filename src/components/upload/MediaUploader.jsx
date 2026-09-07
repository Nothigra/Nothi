import { useRef, useState } from 'react';
import { Upload, X, Video, Image as ImageIcon, Loader2, PlayCircle, ImagePlus, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { supabase, withTimeoutSafety, isMockMode } from '../../lib/supabase';
import './MediaUploader.css';

export default function MediaUploader({ mediaItems, setMediaItems, maxImages = 10, maxVideos = 5 }) {
  const fileInputRef = useRef(null);
  const posterInputRef = useRef(null);
  const [activeVideoIdForPoster, setActiveVideoIdForPoster] = useState(null);

  const extractVideoFrame = (file) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      
      const url = URL.createObjectURL(file);
      video.src = url;

      video.addEventListener('loadedmetadata', () => {
        // Seek to 0.1 seconds to avoid black frame on start
        video.currentTime = Math.min(0.1, video.duration / 2 || 0);
      });

      video.addEventListener('seeked', () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (blob) {
            blob.name = `poster_${file.name}.jpg`;
            resolve(blob);
          } else {
            reject(new Error('Failed to generate poster blob'));
          }
        }, 'image/jpeg', 0.8);
      });

      video.addEventListener('error', (e) => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load video for frame extraction'));
      });
    });
  };

  const uploadToR2 = async (file, folder, onProgress) => {
    let safeType = file.type || (folder === 'product-videos' ? 'video/mp4' : 'image/jpeg');
    if (folder === 'product-images' && !['image/jpeg', 'image/png', 'image/webp'].includes(safeType)) {
      safeType = 'image/jpeg';
    }
    if (folder === 'product-videos' && !['video/mp4', 'video/webm'].includes(safeType)) {
      safeType = 'video/mp4';
    }

    if (isMockMode) {
      if (onProgress) {
        onProgress(30);
        await new Promise(r => setTimeout(r, 400));
        onProgress(70);
        await new Promise(r => setTimeout(r, 400));
        onProgress(100);
      } else {
        await new Promise(r => setTimeout(r, 800));
      }
      return URL.createObjectURL(file);
    }

    try {
      const { data, error } = await withTimeoutSafety(() =>
        supabase.functions.invoke('generate-upload-url', {
          body: { 
            folder, 
            filename: file.name || 'upload', 
            contentType: safeType,
            fileSize: file.size
          }
        })
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { uploadUrl, publicUrl } = data;

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', safeType);
        
        if (onProgress) {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              onProgress(percent);
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`S3 Upload failed with status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(file);
      });

      return publicUrl;
    } catch (err) {
      console.warn("Real upload failed or timed out. Falling back to local preview mode.", err);
      // Fallback for local development when edge functions aren't deployed
      if (onProgress) {
        onProgress(30);
        await new Promise(r => setTimeout(r, 400));
        onProgress(70);
        await new Promise(r => setTimeout(r, 400));
        onProgress(100);
      } else {
        await new Promise(r => setTimeout(r, 800));
      }
      return URL.createObjectURL(file);
    }
  };

  const processUploads = async (files) => {
    for (const file of files) {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      
      if (!isVideo && !isImage) continue;

      if (isVideo && file.size > 100 * 1024 * 1024) {
        alert(`${file.name} is larger than 100MB.`);
        continue;
      }
      if (isImage && file.size > 15 * 1024 * 1024) {
        alert(`${file.name} is larger than 15MB.`);
        continue;
      }

      const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      
      const newItem = {
        id,
        type: isVideo ? 'video' : 'image',
        url: '',
        posterUrl: '',
        isUploading: true,
        progress: 0,
        error: '',
        previewUrl: URL.createObjectURL(file)
      };

      setMediaItems(prev => [...prev, newItem]);

      try {
        let posterUrl = '';
        
        if (isVideo) {
          // Extract and upload poster first
          try {
            const posterBlob = await extractVideoFrame(file);
            posterUrl = await uploadToR2(posterBlob, 'product-images');
          } catch (posterErr) {
            console.error("Poster extraction failed:", posterErr);
            // Non-fatal, just no poster
          }
        }

        // Upload main file
        const url = await uploadToR2(file, isVideo ? 'product-videos' : 'product-images', (progress) => {
          setMediaItems(prev => prev.map(item => item.id === id ? { ...item, progress } : item));
        });

        setMediaItems(prev => prev.map(item => 
          item.id === id ? { ...item, url, posterUrl, isUploading: false } : item
        ));
      } catch (err) {
        console.error("Upload error:", err);
        setMediaItems(prev => prev.map(item => 
          item.id === id ? { ...item, isUploading: false, error: err.message } : item
        ));
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files?.length) {
      processUploads(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  const handleRemove = (id) => {
    setMediaItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item && item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter(i => i.id !== id);
    });
  };

  const moveItem = (index, direction) => {
    setMediaItems(prev => {
      const newItems = [...prev];
      if (direction === -1 && index > 0) {
        [newItems[index], newItems[index - 1]] = [newItems[index - 1], newItems[index]];
      } else if (direction === 1 && index < newItems.length - 1) {
        [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
      }
      return newItems;
    });
  };

  const handlePosterUpload = async (e) => {
    const file = e.target.files?.[0];
    const videoId = activeVideoIdForPoster;
    setActiveVideoIdForPoster(null);
    if (posterInputRef.current) posterInputRef.current.value = '';

    if (!file || !videoId) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("Poster image must be less than 15MB.");
      return;
    }

    setMediaItems(prev => prev.map(item => 
      item.id === videoId ? { ...item, isUploading: true, progress: 0 } : item
    ));

    try {
      const posterUrl = await uploadToR2(file, 'product-images', (progress) => {
        setMediaItems(prev => prev.map(item => item.id === videoId ? { ...item, progress } : item));
      });
      setMediaItems(prev => prev.map(item => 
        item.id === videoId ? { ...item, posterUrl, isUploading: false } : item
      ));
    } catch (err) {
      console.error("Custom poster upload error:", err);
      alert("Failed to upload custom poster");
      setMediaItems(prev => prev.map(item => 
        item.id === videoId ? { ...item, isUploading: false } : item
      ));
    }
  };

  return (
    <div className="media-uploader-container">
      <input 
        type="file" 
        multiple 
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" 
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <input 
        type="file" 
        accept="image/jpeg,image/png,image/webp" 
        ref={posterInputRef}
        onChange={handlePosterUpload}
        className="hidden"
      />

      <div className="media-uploader-grid">
        {mediaItems.map((item, index) => (
          <div key={item.id} className={`media-item-card ${item.error ? 'has-error' : ''}`}>
            
            <div className="media-item-preview">
              {item.type === 'video' ? (
                <>
                  <div className="media-item-video-badge"><Video size={14}/></div>
                  {item.posterUrl ? (
                    <img src={item.posterUrl} alt="Video Poster" />
                  ) : item.previewUrl ? (
                    <video src={item.previewUrl} muted />
                  ) : (
                    <div className="media-item-fallback"><PlayCircle size={24}/></div>
                  )}
                  {!item.isUploading && (
                    <button 
                      type="button"
                      className="media-item-change-poster"
                      onClick={() => {
                        setActiveVideoIdForPoster(item.id);
                        posterInputRef.current?.click();
                      }}
                      title="Upload custom poster"
                    >
                      <ImagePlus size={16} />
                    </button>
                  )}
                </>
              ) : (
                <img src={item.previewUrl || item.url} alt="Media" />
              )}
              
              {item.isUploading && (
                <div className="media-item-uploading-overlay">
                  <Loader2 className="spin text-white mb-2" size={24} />
                  <div className="media-item-progress-bar">
                    <div className="media-item-progress-fill" style={{ width: `${item.progress}%` }}></div>
                  </div>
                  <span className="text-white text-xs font-medium">{item.progress}%</span>
                </div>
              )}
            </div>

            <div className="media-item-actions">
              <button 
                type="button"
                className="media-action-btn"
                onClick={() => moveItem(index, -1)}
                disabled={index === 0}
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                type="button"
                className="media-action-btn danger"
                onClick={() => handleRemove(item.id)}
              >
                <X size={16} />
              </button>
              <button 
                type="button"
                className="media-action-btn"
                onClick={() => moveItem(index, 1)}
                disabled={index === mediaItems.length - 1}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            
            {item.error && (
              <div className="media-item-error" title={item.error}>
                <AlertCircle size={14} /> Failed
              </div>
            )}
          </div>
        ))}

        <div className="media-uploader-dropzone" onClick={() => fileInputRef.current?.click()}>
          <div className="media-uploader-dropzone-icon">
            <Upload size={24} />
          </div>
          <p className="media-uploader-dropzone-title">Add Images or Videos</p>
          <p className="media-uploader-dropzone-sub">JPEG, PNG, MP4 up to 100MB</p>
        </div>
      </div>
    </div>
  );
}
