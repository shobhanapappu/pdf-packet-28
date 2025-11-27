import { PDFDocument, rgb, PageSizes } from 'pdf-lib';
import { supabase } from './supabaseClient';
import type { ProjectFormData, SelectedDocument } from '@/types';

interface PDFPacketOptions {
  title: string;
  projectNumber?: string;
  preparedBy: string;
  submittedTo: string;
  date: string;
  documents: Array<{
    title: string;
    pageNumber: number;
  }>;
}

class PDFService {
  private async getPdfBytes(url: string): Promise<Uint8Array> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  private async createCoverPage(pdfDoc: PDFDocument, options: PDFPacketOptions) {
    const { title, projectNumber, preparedBy, submittedTo, date } = options;
    const page = pdfDoc.addPage(PageSizes.A4);
    const { width, height } = page.getSize();
    const fontSize = 24;
    const lineHeight = 1.5;
    
    // Add background
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(0.95, 0.95, 0.97),
      borderWidth: 0,
    });

    // Add title
    page.drawText(title, {
      x: 50,
      y: height - 100,
      size: fontSize * 1.5,
      color: rgb(0.2, 0.2, 0.2),
    });

    // Add project info
    const infoY = height - 200;
    const infoText = [
      `Project: ${projectNumber || 'N/A'}`,
      `Prepared By: ${preparedBy}`,
      `Submitted To: ${submittedTo}`,
      `Date: ${new Date(date).toLocaleDateString()}`,
    ];

    infoText.forEach((text, index) => {
      page.drawText(text, {
        x: 50,
        y: infoY - index * (fontSize * lineHeight),
        size: fontSize * 0.7,
        color: rgb(0.3, 0.3, 0.3),
      });
    });
  }

  private async createTableOfContents(pdfDoc: PDFDocument, options: PDFPacketOptions) {
    const { documents } = options;
    const page = pdfDoc.addPage(PageSizes.A4);
    const { width, height } = page.getSize();
    const fontSize = 12;
    const lineHeight = 1.5;

    // Add TOC title
    page.drawText('Table of Contents', {
      x: 50,
      y: height - 100,
      size: fontSize * 1.5,
      color: rgb(0.2, 0.2, 0.2),
    });

    // Add document entries
    documents.forEach((doc, index) => {
      const yPos = height - 150 - (index * (fontSize * lineHeight));
      
      // Document title
      page.drawText(doc.title, {
        x: 50,
        y: yPos,
        size: fontSize,
        color: rgb(0.3, 0.3, 0.3),
      });

      // Page number
      page.drawText(doc.pageNumber.toString(), {
        x: width - 100,
        y: yPos,
        size: fontSize,
        color: rgb(0.5, 0.5, 0.5),
      });
    });
  }

  async generatePacket(
    formData: ProjectFormData,
    selectedDocuments: Omit<SelectedDocument, 'pageNumber'>[]
  ): Promise<Uint8Array> {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Add cover page
    await this.createCoverPage(pdfDoc, {
      title: `${formData.productType} Document Packet`,
      projectNumber: formData.projectNumber,
      preparedBy: formData.preparedBy,
      submittedTo: formData.submittedTo,
      date: formData.date,
      documents: selectedDocuments.map(doc => ({
        title: doc.document.name,
        pageNumber: 0, // Will be updated after adding all pages
      })),
    });

    // Add table of contents (page numbers will be updated later)
    await this.createTableOfContents(pdfDoc, {
      title: `${formData.productType} Document Packet`,
      projectNumber: formData.projectNumber,
      preparedBy: formData.preparedBy,
      submittedTo: formData.submittedTo,
      date: formData.date,
      documents: selectedDocuments.map(doc => ({
        title: doc.document.name,
        pageNumber: 0, // Will be updated after adding all pages
      })),
    });

    let currentPageNumber = 3; // Start after cover and TOC (cover = 1, TOC = 1, next page = 3)

    // Create a copy of selected documents with page numbers
    const documentsWithPageNumbers = selectedDocuments.map(doc => ({
      ...doc,
      pageNumber: 0 // Will be updated with actual page numbers
    }));

    // Process each selected document
    for (const doc of documentsWithPageNumbers) {
      try {
        // Get a signed URL for the document with proper error handling
        const documentUrl = await this.getDocumentUrl(doc.document.filename);

        // Download the PDF using the signed URL
        const pdfBytes = await this.getPdfBytes(documentUrl);
        const pdf = await PDFDocument.load(pdfBytes);
        
        // Copy all pages
        const pages = await pdfDoc.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => {
          pdfDoc.addPage(page);
        });

        // Update document with actual page number
        doc.pageNumber = currentPageNumber;

        currentPageNumber += pdf.getPageCount();
      } catch (error) {
        console.error(`Error processing document ${doc.document.name}:`, error);
        // Continue with next document even if one fails
      }
    }

    // Update TOC with correct page numbers
    const pages = pdfDoc.getPages();
    const tocPage = pages[1]; // TOC is the second page (index 1)
    
    // Clear existing TOC content
    const { width, height } = tocPage.getSize();
    tocPage.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(1, 1, 1),
      borderWidth: 0,
    });

    // Recreate TOC with updated page numbers
    await this.createTableOfContents(pdfDoc, {
      title: `${formData.productType} Document Packet`,
      projectNumber: formData.projectNumber,
      preparedBy: formData.preparedBy,
      submittedTo: formData.submittedTo,
      date: formData.date,
      documents: documentsWithPageNumbers.map(doc => ({
        title: doc.document.name,
        pageNumber: doc.pageNumber,
      })),
    });

    // Save the final PDF
    return await pdfDoc.save();
  }

  async downloadPdf(pdfBytes: Uint8Array, filename: string) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'document-packet.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async previewPDF(pdfBytes: Uint8Array): Promise<string> {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  }

  async getDocumentUrl(filename: string): Promise<string> {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(filename, 3600); // URL valid for 1 hour
      
      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw new Error('Failed to generate document URL');
    }
  }
}

export const pdfService = new PDFService();