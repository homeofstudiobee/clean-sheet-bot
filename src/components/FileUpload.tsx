import { useCallback } from 'react';
import { Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { importFile } from '@/utils/fileHandlers';
import { DataRow } from '@/types/data';

interface FileUploadProps {
  onDataLoaded: (data: DataRow[]) => void;
}

export const FileUpload = ({ onDataLoaded }: FileUploadProps) => {
  const { toast } = useToast();

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a CSV or Excel file',
          variant: 'destructive',
        });
        return;
      }

      try {
        const data = await importFile(file);
        onDataLoaded(data);
        toast({
          title: 'File loaded successfully',
          description: `${data.length} rows imported`,
        });
      } catch (error) {
        toast({
          title: 'Error loading file',
          description: 'Please check your file format and try again',
          variant: 'destructive',
        });
      }
    },
    [onDataLoaded, toast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  return (
    <div
      className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer bg-card"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <input
        id="file-input"
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
        }}
      />
      <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2 text-foreground">Upload your data file</h3>
      <p className="text-sm text-muted-foreground">
        Drag and drop or click to select CSV or Excel files
      </p>
    </div>
  );
};
