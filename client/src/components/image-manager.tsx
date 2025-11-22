import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X, Upload, Edit, Star } from "lucide-react";
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (images.length >= maxImages) {
      toast({
        title: "Image limit reached",
        description: `You can only upload ${maxImages} images with your current plan.`,
        variant: "destructive",
      });
      return;
    }

    setUploadingImage(true);
    try {
      const objectPath = await uploadImage(file);
      onImagesChange([...images, objectPath]);
      onMetadataChange([...imageMetadata, { 
        rotation: 0, 
        zoom: 1, 
        crop: { x: 0, y: 0, width: 100, height: 100 },
        cropPixels: undefined  // Will be set when user edits the image
      }]);
      toast({
        title: "Image uploaded",
        description: "Image uploaded successfully",
      });
    } catch (error) {
      console.error("Failed to upload image:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
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
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

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
    if (mainImageIndex === draggedIndex) {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Service Images ({images.length}/{maxImages})</Label>
        {maxImages === 3 && (
          <p className="text-xs text-muted-foreground">
            Upgrade your plan for more images
          </p>
        )}
      </div>

      {/* Upload area */}
      {images.length < maxImages && (
        <div className="border-2 border-dashed rounded-lg p-6 text-center">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
            id="image-upload"
            data-testid="input-image-upload"
            disabled={uploadingImage}
          />
          <label 
            htmlFor="image-upload" 
            className={`cursor-pointer flex flex-col items-center gap-2 ${uploadingImage ? 'opacity-50' : ''}`}
          >
            <Upload className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm">
              {uploadingImage ? 'Uploading...' : 'Click to upload images'}
            </span>
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
                transition={{ duration: 0.3, layout: { duration: 0.4 } }}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`relative group cursor-move transition-opacity ${
                  draggedIndex === idx ? 'opacity-50' : ''
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
          Drag images to reorder • Click <Star className="w-3 h-3 inline" /> to set main image • Click <Edit className="w-3 h-3 inline" /> to crop/rotate
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
