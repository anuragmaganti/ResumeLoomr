import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

const DEFAULT_DOCUMENT_TITLE = 'ResumeLoomr | Professional Resume Builder';

export function useResumePrint({ activeResumeName, printResume }) {
  const originalDocumentTitleRef = useRef(DEFAULT_DOCUMENT_TITLE);
  const [isPrintRendering, setIsPrintRendering] = useState(false);

  useEffect(() => {
    originalDocumentTitleRef.current = document.title || originalDocumentTitleRef.current;
  }, []);

  useEffect(() => {
    function preparePrintPreview() {
      flushSync(() => setIsPrintRendering(true));
    }

    function restoreDocumentTitle() {
      document.title = originalDocumentTitleRef.current;
      setIsPrintRendering(false);
    }

    window.addEventListener('beforeprint', preparePrintPreview);
    window.addEventListener('afterprint', restoreDocumentTitle);

    return () => {
      window.removeEventListener('beforeprint', preparePrintPreview);
      window.removeEventListener('afterprint', restoreDocumentTitle);
    };
  }, []);

  function handlePrint() {
    document.title = activeResumeName || 'Resume';
    flushSync(() => setIsPrintRendering(true));
    printResume();
  }

  return { handlePrint, isPrintRendering };
}
