import type { Document, ProductType } from '@/types'
import { documentService } from '@/services/documentService'

// Real PDF documents will be fetched from IndexedDB
let availableDocuments: Document[] = [];

// Function to load documents dynamically
async function loadDocuments(): Promise<void> {
  try {
    // Load from IndexedDB
    const uploadedDocs = await documentService.getAllDocuments();
    availableDocuments = uploadedDocs;
    console.log('Documents loaded from local storage:', availableDocuments.length);
  } catch (error) {
    console.error('Failed to load documents:', error);
    availableDocuments = [];
  }
}

// Load documents on module initialization
loadDocuments();

// Export function to reload documents (useful after uploads)
export async function reloadDocuments(): Promise<void> {
  await loadDocuments();
}

// Get documents by product type
export function getDocumentsByProductType(productType: ProductType): Document[] {
  try {
    console.log(`Filtering documents for product type: ${productType}`);
    console.log('Available documents:', availableDocuments);
    
    const filteredDocs = availableDocuments.filter(doc => {
      const matches = doc.productType === productType;
      console.log(`Document: ${doc.name}, Type: ${doc.productType}, Matches: ${matches}`);
      return matches;
    });
    
    console.log(`Found ${filteredDocs.length} documents for ${productType}`);
    return filteredDocs;
  } catch (error) {
    console.error('Error filtering documents by product type:', error);
    return [];
  }
}

export { availableDocuments }

// Document type configurations
export const documentTypeConfig = {
  TDS: {
    color: 'blue',
    icon: '📋',
    priority: 1,
  },
  ESR: {
    color: 'green',
    icon: '✅',
    priority: 2,
  },
  MSDS: {
    color: 'red',
    icon: '⚠️',
    priority: 8,
  },
  LEED: {
    color: 'emerald',
    icon: '🌿',
    priority: 6,
  },
  Installation: {
    color: 'orange',
    icon: '🔧',
    priority: 3,
  },
  warranty: {
    color: 'purple',
    icon: '🛡️',
    priority: 4,
  },
  Acoustic: {
    color: 'indigo',
    icon: '🔊',
    priority: 7,
  },
  PartSpec: {
    color: 'gray',
    icon: '📐',
    priority: 5,
  },
};
