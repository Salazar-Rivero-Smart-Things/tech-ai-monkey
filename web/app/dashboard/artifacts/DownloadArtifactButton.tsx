"use client";

export default function DownloadArtifactButton({ artifactId, artifactTitle, artifactContent }: { artifactId: string, artifactTitle: string, artifactContent: string }) {
  const handleDownload = () => {
    try {
      const files = JSON.parse(artifactContent);
      if (!Array.isArray(files)) throw new Error("Not an array");
      
      files.forEach((file: any, index: number) => {
        setTimeout(() => {
          const blob = new Blob([file.content], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = file.path || `file-${index}.txt`;
          a.click();
          URL.revokeObjectURL(url);
        }, index * 200); // slight delay to prevent browser blocking multiple downloads
      });
    } catch {
      // Fallback if content isn't our specific JSON format
      const blob = new Blob([artifactContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${artifactTitle}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <button
      onClick={handleDownload}
      className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
    >
      Download
    </button>
  );
}
