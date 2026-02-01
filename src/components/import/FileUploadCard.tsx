import { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileUploadCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
  status?: 'idle' | 'success' | 'error';
  statusMessage?: string;
  acceptFormats?: string;
}

export function FileUploadCard({
  title,
  description,
  icon,
  onFileSelect,
  isLoading = false,
  status = 'idle',
  statusMessage,
  acceptFormats = '.xlsx,.xls',
}: FileUploadCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const validExtensions = acceptFormats.split(',').map(ext => ext.trim().toLowerCase());
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
      if (validExtensions.includes(fileExt)) {
        setSelectedFile(file);
        onFileSelect(file);
      }
    }
  }, [onFileSelect, acceptFormats]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      onFileSelect(files[0]);
    }
  }, [onFileSelect]);

  const clearFile = () => {
    setSelectedFile(null);
  };

  return (
    <Card className={cn(
      'relative overflow-hidden transition-all duration-300',
      isDragging && 'ring-2 ring-primary ring-offset-2',
      status === 'success' && 'border-success/50',
      status === 'error' && 'border-destructive/50',
    )}>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={cn(
            'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all',
            isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
            isLoading && 'pointer-events-none opacity-50',
          )}
        >
          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processando arquivo...</p>
            </div>
          ) : selectedFile ? (
            <div className="flex flex-col items-center gap-3">
              <FileSpreadsheet className="h-10 w-10 text-primary" />
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{selectedFile.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={clearFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Upload className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="mb-1 text-sm font-medium">Arraste o arquivo aqui</p>
              <p className="mb-4 text-xs text-muted-foreground">ou clique para selecionar</p>
              <input
                type="file"
                accept={acceptFormats}
                onChange={handleFileInput}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </>
          )}
        </div>
        
        {status !== 'idle' && statusMessage && (
          <div className={cn(
            'mt-4 flex items-center gap-2 rounded-lg p-3',
            status === 'success' && 'bg-success/10 text-success',
            status === 'error' && 'bg-destructive/10 text-destructive',
          )}>
            {status === 'success' ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span className="text-sm">{statusMessage}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
