import React, { useEffect } from 'react';

function PdfViewer() {
  useEffect(() => {
    const handleCompilationDone = (data) => {
      const pdfContainer = document.getElementById('pdf-container');
      const pdfLoading = document.getElementById('pdf-loading');
      if (data.status === 'success') {
        const pdfFileName = data.path.replace(/\.tex$/, '.pdf');
        let iframe = document.getElementById('pdf-viewer');
        if (!iframe) {
          pdfContainer.innerHTML = `<iframe id="pdf-viewer" src="/pdf?file=${encodeURIComponent(pdfFileName)}#toolbar=0" style="width: 100%; height: 100%; border: none;"></iframe>`;
          pdfContainer.appendChild(pdfLoading);
        } else {
          iframe.src = '/pdf?file=' + encodeURIComponent(pdfFileName) + '&ts=' + new Date().getTime() + '#toolbar=0';
        }
        iframe = document.getElementById('pdf-viewer');
        iframe.onload = function() {
          document.getElementById('pdf-loading').style.display = "none";
        };
      } else {
        pdfContainer.innerHTML = `
          <div style="
              height: 100%;
              width: 100%;
              box-sizing: border-box;
              padding: 20px;
              overflow-y: auto;
              color: #ffaaaa;
              font-family: monospace;
              background: var(--bg-color);
          ">
            <h2 style="color: #ff5555;">Compilation Error</h2>
            <pre style="white-space: pre-wrap;">${data.logs}</pre>
          </div>
        `;
        document.getElementById('pdf-loading').style.display = "none";
      }
    };

    window.socket.on('compilation_done', handleCompilationDone);

    return () => {
      window.socket.off('compilation_done', handleCompilationDone);
    };
  }, []);

  return (
    <div id="pdf-container" className="pane">
      <div id="pdf-loading" className="hidden">
        <div className="loader"></div>
      </div>
    </div>
  );
}

export default PdfViewer;
