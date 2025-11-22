import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RotateCw, RotateCcw } from "lucide-react";

interface Point {
  x: number;
  y: number;
}

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageMetadata {
  crop?: Area;
  rotation: number;
  position?: Point;
}

interface ImageEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  onSave: (metadata: ImageMetadata) => void;
  initialMetadata?: ImageMetadata;
}

export function ImageEditor({ 
  open, 
  onOpenChange, 
  imageUrl, 
  onSave,
  initialMetadata 
}: ImageEditorProps) {
  const [crop, setCrop] = useState<Point>(initialMetadata?.crop ? { x: initialMetadata.crop.x, y: initialMetadata.crop.y } : { x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(initialMetadata?.rotation || 0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = () => {
    if (croppedAreaPixels) {
      onSave({
        crop: croppedAreaPixels,
        rotation,
        position: { x: 50, y: 50 },
      });
      onOpenChange(false);
    }
  };

  const handleRotateLeft = () => {
    setRotation((prev) => (prev - 90) % 360);
  };

  const handleRotateRight = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Image</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Cropper */}
          <div className="relative h-96 bg-slate-900 rounded-lg overflow-hidden">
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={4 / 3}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Rotation Buttons */}
            <div className="flex items-center gap-4">
              <Label className="w-24">Rotation</Label>
              <div className="flex gap-2 flex-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRotateLeft}
                  data-testid="button-rotate-left"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Rotate Left
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRotateRight}
                  data-testid="button-rotate-right"
                >
                  <RotateCw className="w-4 h-4 mr-2" />
                  Rotate Right
                </Button>
                <span className="text-sm text-muted-foreground ml-auto">{rotation}°</span>
              </div>
            </div>

            {/* Zoom Slider */}
            <div className="flex items-center gap-4">
              <Label className="w-24">Zoom</Label>
              <Slider
                value={[zoom]}
                onValueChange={(values) => setZoom(values[0])}
                min={1}
                max={3}
                step={0.1}
                className="flex-1"
                data-testid="slider-zoom"
              />
              <span className="text-sm text-muted-foreground w-12 text-right">{zoom.toFixed(1)}x</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit">
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="button-save-edit">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
