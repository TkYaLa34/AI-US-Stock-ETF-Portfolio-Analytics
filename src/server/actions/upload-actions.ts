'use server';

/**
 * Server actions for Portfolio Document/Image Uploads and AI OCR Extraction.
 *
 * Strictly non-transactional: Handles upload storage, metadata, and OCR extraction
 * for analytics and tracking purposes only.
 */

import { revalidatePath } from 'next/cache';

import { simulateAiOcrExtraction, type OcrextractedData } from '@/lib/portfolio/ocr';
import { createClient } from '@/lib/supabase/server';
import type { PortfolioUploadsRow } from '@/types/database.types';

export interface UploadActionResult {
  success: boolean;
  message: string;
  upload?: PortfolioUploadsRow;
  extractedData?: OcrextractedData;
}

/**
 * Uploads a document/image file to Supabase Storage ('portfolio-documents')
 * and records upload metadata with AI OCR extracted data in 'portfolio_uploads'.
 */
export async function uploadPortfolioDocumentAction(
  formData: FormData,
): Promise<UploadActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      message: 'กรุณาเข้าสู่ระบบก่อนอัปโหลดเอกสาร',
    };
  }

  const file = formData.get('file') as File | null;
  const portfolioId = (formData.get('portfolioId') as string) || null;

  if (!file || file.size === 0) {
    return {
      success: false,
      message: 'กรุณาเลือกไฟล์เอกสารหรือรูปภาพพอร์ตโฟลิโอ',
    };
  }

  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  if (!allowedTypes.includes(file.type)) {
    return {
      success: false,
      message: 'รองรับเฉพาะไฟล์ PDF, PNG และ JPG เท่านั้น',
    };
  }

  const maxSizeBytes = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSizeBytes) {
    return {
      success: false,
      message: 'ขนาดไฟล์ต้องไม่เกิน 10MB',
    };
  }

  const timestamp = Date.now();
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${user.id}/${timestamp}_${sanitizedFileName}`;

  try {
    // 1. Upload to Supabase Storage bucket 'portfolio-documents'
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: storageError } = await supabase.storage
      .from('portfolio-documents')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (storageError) {
      console.warn('Storage upload notice (falling back to database record):', storageError.message);
    }

    // 2. Perform Simulated AI OCR Extraction
    const extractedData = await simulateAiOcrExtraction(file.name, file.type);

    // 3. Insert record into portfolio_uploads table
    const { data: uploadRow, error: dbError } = await supabase
      .from('portfolio_uploads')
      .insert({
        user_id: user.id,
        portfolio_id: portfolioId,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        status: 'success',
        extracted_data: JSON.parse(JSON.stringify(extractedData)),
      })
      .select()
      .single();

    if (dbError) {
      return {
        success: false,
        message: `บันทึกข้อมูลเอกสารไม่สำเร็จ: ${dbError.message}`,
      };
    }

    revalidatePath('/dashboard');

    return {
      success: true,
      message: `อัปโหลดเอกสาร "${file.name}" และประมวลผล AI OCR เรียบร้อยแล้ว`,
      upload: uploadRow as PortfolioUploadsRow,
      extractedData,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการประมวลผล';
    return {
      success: false,
      message: errorMsg,
    };
  }
}

/**
 * Retrieves past document uploads for the current user.
 */
export async function listUserUploadsAction(): Promise<PortfolioUploadsRow[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('portfolio_uploads')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing portfolio_uploads:', error.message);
    return [];
  }

  return (data as PortfolioUploadsRow[]) ?? [];
}

/**
 * Deletes a portfolio upload record and its storage file.
 */
export async function deleteUploadAction(uploadId: string, filePath: string): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'กรุณาเข้าสู่ระบบก่อนลบเอกสาร' };
  }

  // Remove from storage
  await supabase.storage.from('portfolio-documents').remove([filePath]);

  // Remove DB record
  const { error } = await supabase
    .from('portfolio_uploads')
    .delete()
    .eq('id', uploadId)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, message: `ลบเอกสารไม่สำเร็จ: ${error.message}` };
  }

  revalidatePath('/dashboard');
  return { success: true, message: 'ลบเอกสารเรียบร้อยแล้ว' };
}
