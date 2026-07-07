package pdfutil

import (
	"bytes"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
)

// PageCount returns the number of pages in a PDF byte slice. It returns 0 on
// any parse error so a malformed-but-storable PDF still creates an item.
func PageCount(data []byte) int {
	conf := model.NewDefaultConfiguration()
	n, err := api.PageCount(bytes.NewReader(data), conf)
	if err != nil {
		return 0
	}
	return n
}

// Note on thumbnails: rasterising a PDF page to JPEG in pure Go is not supported
// by pdfcpu (it manipulates PDF structure, it does not render). Generating a
// real first-page thumbnail requires a rasteriser such as MuPDF (go-fitz) or
// pdfium, which pull in CGo/native deps. For the MVP the PDF card renders a
// styled placeholder using the filename + page count, and the detail panel uses
// react-pdf (pdf.js) to render the document inline from the presigned URL — so
// no server-side rasterisation is needed. Wire a rasteriser here later if a
// grid thumbnail is desired.
