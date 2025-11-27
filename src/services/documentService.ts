import { supabase } from './supabaseClient'
import type { Document, DocumentType, ProductType } from '@/types'

class DocumentService {
  private async validatePDF(file: File): Promise<{ valid: boolean; error?: string }> {
    if (file.type !== 'application/pdf') {
      return { valid: false, error: 'File must be a PDF document' }
    }

    const MAX_SIZE = 50 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return { valid: false, error: 'File size exceeds 50MB limit' }
    }

    if (file.size < 1024) {
      return { valid: false, error: 'File is too small to be a valid PDF' }
    }

    try {
      const arrayBuffer = await file.slice(0, 5).arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      const signature = String.fromCharCode(...bytes)

      if (!signature.startsWith('%PDF')) {
        return { valid: false, error: 'File does not appear to be a valid PDF' }
      }

      return { valid: true }
    } catch (error) {
      return { valid: false, error: 'Failed to read file' }
    }
  }

  async getAllDocuments(): Promise<Document[]> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching documents:', error)
        return []
      }

      return (data || []).map(doc => ({
        id: doc.id,
        name: doc.name,
        description: doc.description,
        filename: doc.filename,
        url: doc.file_path,
        size: doc.size,
        type: doc.type,
        required: doc.required,
        products: doc.products || [],
        productType: doc.product_type
      }))
    } catch (error) {
      console.error('Error fetching documents:', error)
      return []
    }
  }

  async getDocumentsByProductType(productType: ProductType): Promise<Document[]> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('product_type', productType)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching documents:', error)
        return []
      }

      return (data || []).map(doc => ({
        id: doc.id,
        name: doc.name,
        description: doc.description,
        filename: doc.filename,
        url: doc.file_path,
        size: doc.size,
        type: doc.type,
        required: doc.required,
        products: doc.products || [],
        productType: doc.product_type
      }))
    } catch (error) {
      console.error('Error fetching documents by product type:', error)
      return []
    }
  }

  async getDocument(id: string): Promise<Document | null> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error || !data) {
        console.error('Error fetching document:', error)
        return null
      }

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        filename: data.filename,
        url: data.file_path,
        size: data.size,
        type: data.type,
        required: data.required,
        products: data.products || [],
        productType: data.product_type
      }
    } catch (error) {
      console.error('Error fetching document:', error)
      return null
    }
  }

  async uploadDocument(
    file: File,
    productType: ProductType,
    onProgress?: (progress: number) => void
  ): Promise<Document> {
    const validation = await this.validatePDF(file)
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid PDF file')
    }

    try {
      if (onProgress) onProgress(25)

      const type = this.detectDocumentType(file.name)
      const name = this.extractDocumentName(file.name, type)

      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${productType}/${fileName}`

      if (onProgress) onProgress(50)

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file)

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      if (onProgress) onProgress(75)

      const { error: insertError, data } = await supabase
        .from('documents')
        .insert([
          {
            name,
            description: type + ' Document',
            filename: file.name,
            size: file.size,
            type,
            required: false,
            products: [],
            product_type: productType,
            file_path: filePath
          }
        ])
        .select()
        .single()

      if (insertError) {
        await supabase.storage.from('documents').remove([filePath])
        throw new Error(insertError.message)
      }

      if (onProgress) onProgress(100)

      const document: Document = {
        id: data.id,
        name: data.name,
        description: data.description,
        filename: data.filename,
        url: data.file_path,
        size: data.size,
        type: data.type,
        required: data.required,
        products: data.products || [],
        productType: data.product_type
      }

      return document
    } catch (error) {
      console.error('Error in uploadDocument:', error)
      throw error instanceof Error ? error : new Error('Failed to upload document')
    }
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<void> {
    try {
      const existing = await this.getDocument(id)
      if (!existing) {
        throw new Error('Document not found')
      }

      const updateData: any = {}
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.description !== undefined) updateData.description = updates.description
      if (updates.type !== undefined) updateData.type = updates.type

      const { error } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', id)

      if (error) {
        throw new Error(error.message)
      }
    } catch (error) {
      console.error('Error updating document:', error)
      throw error instanceof Error ? error : new Error('Failed to update document')
    }
  }

  async deleteDocument(id: string): Promise<void> {
    try {
      const doc = await this.getDocument(id)
      if (!doc) {
        throw new Error('Document not found')
      }

      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      await supabase.storage
        .from('documents')
        .remove([doc.url])
    } catch (error) {
      console.error('Error deleting document:', error)
      throw error instanceof Error ? error : new Error('Failed to delete document')
    }
  }

  async getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, expiresIn)

    if (error) {
      throw new Error(error.message)
    }

    return data.signedUrl
  }

  async downloadDocument(id: string): Promise<Blob | null> {
    try {
      const doc = await this.getDocument(id)
      if (!doc) return null

      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.url)

      if (error) {
        throw new Error(error.message)
      }

      return data
    } catch (error) {
      console.error('Error downloading document:', error)
      return null
    }
  }

  async exportDocumentAsBase64(id: string): Promise<string | null> {
    try {
      const blob = await this.downloadDocument(id)
      if (!blob) return null

      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const base64String = (reader.result as string).split(',')[1]
          resolve(base64String)
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.error('Error exporting document:', error)
      return null
    }
  }

  async getAllDocumentsWithData(): Promise<Array<Document & { fileData: string }>> {
    try {
      const documents = await this.getAllDocuments()
      const results = []

      for (const doc of documents) {
        const fileData = await this.exportDocumentAsBase64(doc.id)
        if (fileData) {
          results.push({ ...doc, fileData })
        }
      }

      return results
    } catch (error) {
      console.error('Error fetching all documents with data:', error)
      return []
    }
  }

  private detectDocumentType(filename: string): DocumentType {
    const lower = filename.toLowerCase()

    if (lower.includes('tds') || lower.includes('technical data')) return 'TDS'
    if (lower.includes('esr') || lower.includes('evaluation report')) return 'ESR'
    if (lower.includes('msds') || lower.includes('safety data')) return 'MSDS'
    if (lower.includes('leed')) return 'LEED'
    if (lower.includes('installation') || lower.includes('install')) return 'Installation'
    if (lower.includes('warranty')) return 'warranty'
    if (lower.includes('acoustic') || lower.includes('esl')) return 'Acoustic'
    if (lower.includes('spec') || lower.includes('3-part')) return 'PartSpec'
    if (lower.includes('scraper') || lower.includes('setup') || lower.includes('guide')) return 'Guide'

    return 'Other'
  }

  private extractDocumentName(filename: string, type: DocumentType): string {
    // Remove .pdf extension and any common prefixes/suffixes
    let name = filename
      .replace(/\.pdf$/i, '')
      .replace(/[-_]/g, ' ') // Replace underscores and hyphens with spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim()

    // If the type is 'Other' or 'Guide', return the cleaned filename as is
    if (type === 'Other' || type === 'Guide') {
      return name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    }

    // For known types, use the predefined names
    const typeMap: Record<Exclude<DocumentType, 'Other' | 'Guide'>, string> = {
      TDS: 'Technical Data Sheet',
      ESR: 'Evaluation Report',
      MSDS: 'Material Safety Data Sheet',
      LEED: 'LEED Credit Guide',
      Installation: 'Installation Guide',
      warranty: 'Limited Warranty',
      Acoustic: 'Acoustical Performance',
      PartSpec: '3-Part Specifications'
    }

    return typeMap[type as Exclude<DocumentType, 'Other' | 'Guide'>] || name
  }
}

export const documentService = new DocumentService()
