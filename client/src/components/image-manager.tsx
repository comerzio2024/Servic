import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X, Upload, Edit, Star, Image as ImageIcon } from "lucide-react";
import { ImageEditor } from "@/components/image-editor";
import { uploadImage } from "@/lib/imageUpload";
import { useToast } from "@/hooks/use-toast";

interface ImageMetadata {
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  cropPixels?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  rotation: number;
  zoom?: number;
}

interface ImageManagerProps {
  images: string[];
  imageMetadata: ImageMetadata[];
  mainImageIndex: number;
  maxImages: number;
  onImagesChange: (images: string[]) => void;
  onMetadataChange: (metadata: ImageMetadata[]) => void;
  onMainImageChange: (index: number) => void;
}

interface DragPosition {
  x: number;
  y: number;
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function ImageManager({
  images,
  imageMetadata,
  mainImageIndex,
  maxImages,
  onImagesChange,
  onMetadataChange,
  onMainImageChange,
}: ImageManagerProps) {
  const { toast } = useToast();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const validateFiles = (files: File[]): { validFiles: File[]; errors: string[] } => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      // Check file type
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type. Only JPG, PNG, WebP, and GIF images are allowed.`);
        continue;
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        errors.push(`${file.name}: File too large (${sizeMB}MB). Maximum size is 10MB.`);
        continue;
      }

      validFiles.push(file);
    }

    return { validFiles, errors };
  };

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    // Validate files
    const { validFiles, errors } = validateFiles(files);

    // Show validation errors
    if (errors.length > 0) {
      toast({
        title: "Some files were rejected",
        description: errors.join("\n"),
        variant: "destructive",
      });
    }

    if (validFiles.length === 0) return;

    // Check if adding these files would exceed the limit
    const totalAfterUpload = images.length + validFiles.length;
    if (totalAfterUpload > maxImages) {
      const remainingSlots = maxImages - images.length;
      toast({
        title: "Image limit reached",
        description: `You can only upload ${remainingSlots} more image(s) with your current plan (${maxImages} total).`,
        variant: "destructive",
      });
      // Only upload up to the limit
      const filesToUpload = validFiles.slice(0, remainingSlots);
      if (filesToUpload.length === 0) return;
      await uploadFiles(filesToUpload);
      return;
    }

    await uploadFiles(validFiles);
  };

  const uploadFiles = async (files: File[]) => {
    setUploadingImage(true);
    try {
      // Upload all files in parallel
      const uploadPromises = files.map(file => uploadImage(file));
      const objectPaths = await Promise.all(uploadPromises);
      
      // Create metadata for all new images
      const newMetadata = objectPaths.map(() => ({
        rotation: 0,
        zoom: 1,
        crop: { x: 0, y: 0, width: 100, height: 100 },
        cropPixels: undefined  // Will be set when user edits the image
      }));
      
      onImagesChange([...images, ...objectPaths]);
      onMetadataChange([...imageMetadata, ...newMetadata]);
      
      toast({
        title: "Images uploaded",
        description: `${files.length} image(s) uploaded successfully`,
      });
    } catch (error) {
      console.error("Failed to upload images:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload one or more images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // Reset input
    await processFiles(files);
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    const newMetadata = imageMetadata.filter((_, i) => i !== index);
    onImagesChange(newImages);
    onMetadataChange(newMetadata);
    
    // Adjust main image index if needed
    if (mainImageIndex === index) {
      onMainImageChange(0);
    } else if (mainImageIndex > index) {
      onMainImageChange(mainImageIndex - 1);
    }
  };

  const handleMetadataSave = (metadata: ImageMetadata) => {
    if (editingIndex !== null) {
      const newMetadata = [...imageMetadata];
      newMetadata[editingIndex] = metadata;
      onMetadataChange(newMetadata);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
    setHoveredIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    // Only reorder if we're hovering over a different position
    if (hoveredIndex === index) return;
    
    setHoveredIndex(index);

    const newImages = [...images];
    const newMetadata = [...imageMetadata];
    
    const draggedImage = newImages[draggedIndex];
    const draggedMeta = newMetadata[draggedIndex];
    
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedImage);
    
    newMetadata.splice(draggedIndex, 1);
    newMetadata.splice(index, 0, draggedMeta);
    
    // Update main image index
    let newMainIndex = mainImageIndex;
    
    // If dragging to position 0, make it the main image automatically
    if (index === 0) {
      newMainIndex = 0;
    } else if (mainImageIndex === draggedIndex) {
      newMainIndex = index;
    } else if (draggedIndex < mainImageIndex && index >= mainImageIndex) {
      newMainIndex = mainImageIndex - 1;
    } else if (draggedIndex > mainImageIndex && index <= mainImageIndex) {
      newMainIndex = mainImageIndex + 1;
    }
    
    onImagesChange(newImages);
    onMetadataChange(newMetadata);
    onMainImageChange(newMainIndex);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setHoveredIndex(null);
  };

  const handleSetMainImage = (index: number) => {
    if (index === 0) {
      // Already first, just update the main index
      onMainImageChange(0);
      return;
    }

    // Move the selected image to first position
    const newImages = [...images];
    const newMetadata = [...imageMetadata];
    
    const selectedImage = newImages[index];
    const selectedMeta = newMetadata[index];
    
    // Remove from current position
    newImages.splice(index, 1);
    newMetadata.splice(index, 1);
    
    // Insert at first position
    newImages.unshift(selectedImage);
    newMetadata.unshift(selectedMeta);
    
    // Update all state
    onImagesChange(newImages);
    onMetadataChange(newMetadata);
    onMainImageChange(0); // Main image is now at index 0
  };

  // Drag and drop handlers for file upload
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setIsDraggingOver(false);
      }
      return newCounter;
    });
  };

  const handleDragOverUpload = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    setDragCounter(0);

    if (uploadingImage) {
      toast({
        title: "Upload in progress",
        description: "Please wait for the current upload to complete",
      });
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Service Images ({images.length}/{maxImages})</Label>
        {maxImages === 4 && (
          <p className="text-xs text-muted-foreground">
            Upgrade your plan for more images
          </p>
        )}
      </div>

      {/* Upload area with drag and drop */}
      {images.length < maxImages && (
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOverUpload}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
            ${isDraggingOver 
              ? 'border-primary bg-primary/5 scale-[1.02]' 
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/30'
            }
            ${uploadingImage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          data-testid="image-upload-dropzone"
        >
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            multiple
            onChange={handleImageUpload}
            className="hidden"
            id="image-upload"
            data-testid="input-image-upload"
            disabled={uploadingImage}
          />
          <label 
            htmlFor="image-upload" 
            className={`flex flex-col items-center gap-3 ${uploadingImage ? 'pointer-events-none' : 'cursor-pointer'}`}
          >
            <div className="relative">
              <Upload className={`w-12 h-12 transition-colors ${isDraggingOver ? 'text-primary' : 'text-muted-foreground'}`} />
              {isDraggingOver && (
                <ImageIcon className="w-6 h-6 text-primary absolute -right-2 -bottom-1 animate-bounce" />
              )}
            </div>
            
            <div className="space-y-1">
              <p className={`text-base font-medium transition-colors ${isDraggingOver ? 'text-primary' : 'text-foreground'}`}>
                {uploadingImage 
                  ? 'Uploading...' 
                  : isDraggingOver 
                  ? 'Drop images here!' 
                  : 'Drag and drop images here'
                }
              </p>
              {!uploadingImage && !isDraggingOver && (
                <p className="text-sm text-muted-foreground">
                  or click to browse
                </p>
              )}
            </div>
            
            {!uploadingImage && (
              <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                <p>Supports: JPG, PNG, WebP, GIF</p>
                <p>Max size: 10MB per file</p>
                <p className="font-medium">
                  {maxImages - images.length} {maxImages - images.length === 1 ? 'slot' : 'slots'} remaining
                </p>
              </div>
            )}
          </label>
        </div>
      )}

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {images.map((img, idx) => (
              <motion.div
                key={img}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2, layout: { type: "spring", stiffness: 300, damping: 30 } }}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`relative group cursor-move transition-all ${
                  draggedIndex === idx ? 'opacity-40 scale-95' : ''
                }`}
                data-testid={`image-preview-${idx}`}
              >
              <img 
                src={img} 
                alt={`Service ${idx}`} 
                className="w-full h-32 object-cover rounded border-2 border-border" 
              />
              
              {/* Main image badge */}
              {mainImageIndex === idx && (
                <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" />
                  Main
                </div>
              )}

              {/* Action buttons */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => handleSetMainImage(idx)}
                  data-testid={`button-set-main-${idx}`}
                  title="Set as main image"
                >
                  <Star className={`w-3 h-3 ${mainImageIndex === idx ? 'fill-current' : ''}`} />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditingIndex(idx)}
                  data-testid={`button-edit-image-${idx}`}
                  title="Edit image"
                >
                  <Edit className="w-3 h-3" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => removeImage(idx)}
                  data-testid={`button-remove-image-${idx}`}
                  title="Remove image"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </motion.div>
          ))}
          </AnimatePresence>
        </div>
      )}

      {/* Help text */}
      {images.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Drag images to reorder (first image auto-becomes main) • Click <Star className="w-3 h-3 inline" /> to set main image • Click <Edit className="w-3 h-3 inline" /> to crop/rotate
        </p>
      )}

      {/* Image Editor Modal */}
      {editingIndex !== null && (
        <ImageEditor
          open={editingIndex !== null}
          onOpenChange={(open) => !open && setEditingIndex(null)}
          imageUrl={images[editingIndex]}
          initialMetadata={imageMetadata[editingIndex]}
          onSave={handleMetadataSave}
        />
      )}
    </div>
  );
}
