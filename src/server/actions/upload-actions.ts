'use server';

/**
 * Server actions for Portfolio Document/Image Uploads, AI Vision OCR Extraction,
 * and Database Asset Syncing into target portfolios.
 *
 * Strictly non-transactional analytics and position tracking.
 */

import { revalidatePath } from 'next/cache';

import { simulateAiOcrExtraction, type ExtractedAssetItem, type OcrextractedData } from '@/lib/portfolio/ocr';
import { createClient } from '@/lib/supabase/server';
import type { PortfolioUploadsRow } from '@/types/database.types';

export interface UploadActionResult {
  success: boolean;
  message: string;
  upload?: PortfolioUploadsRow;
  extractedData?: OcrextractedData;
}

export interface SyncAssetsActionResult {
  success: boolean;
  message: string;
  targetPortfolioId?: string;
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
    // 1. Convert file to base64 for Vision AI scanner
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Content = buffer.toString('base64');

    // 2. Upload to Supabase Storage bucket 'portfolio-documents'
    const { error: storageError } = await supabase.storage
      .from('portfolio-documents')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (storageError) {
      console.warn('Storage upload notice (falling back to database record):', storageError.message);
    }

    // 3. Perform Simulated AI Vision OCR Extraction
    const extractedData = await simulateAiOcrExtraction(file.name, file.type, base64Content);

    // 4. Insert record into portfolio_uploads table
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
 * Syncs extracted OCR asset items directly into a target portfolio inside Supabase database.
 * If targetPortfolioId is 'new' or empty, auto-creates a new portfolio.
 */
export async function syncExtractedAssetsAction(
  targetPortfolioId: string,
  extractedAssets: ExtractedAssetItem[],
  sourceFileName?: string,
): Promise<SyncAssetsActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      message: 'กรุณาเข้าสู่ระบบก่อนซิงก์ข้อมูลสินทรัพย์',
    };
  }

  if (!extractedAssets || extractedAssets.length === 0) {
    return {
      success: false,
      message: 'ไม่พบรายการสินทรัพย์จากการสแกนเพื่อนำเข้า',
    };
  }

  let finalPortfolioId = targetPortfolioId;

  // 1. Create New Portfolio if requested
  if (targetPortfolioId === 'new' || !targetPortfolioId) {
    const today = new Date().toLocaleDateString('th-TH');
    const newName = `พอร์ตนำเข้า AI OCR (${sourceFileName ? sourceFileName.slice(0, 20) : today})`;

    const { data: newPortfolio, error: createError } = await supabase
      .from('portfolios')
      .insert({
        user_id: user.id,
        name: newName,
        description: `สร้างอัตโนมัติจากการสแกน AI OCR เอกสาร "${sourceFileName ?? 'Portfolio Statement'}"`,
        base_currency: 'USD',
        cash_balance: 0,
        is_default: false,
      })
      .select()
      .single();

    if (createError || !newPortfolio) {
      return {
        success: false,
        message: `สร้างพอร์ตโฟลิโอใหม่ไม่สำเร็จ: ${createError?.message ?? 'Unknown error'}`,
      };
    }

    finalPortfolioId = newPortfolio.id;
  }

  // 2. Fetch existing assets in target portfolio
  const { data: existingAssets } = await supabase
    .from('assets')
    .select('*')
    .eq('portfolio_id', finalPortfolioId)
    .eq('user_id', user.id);

  const existingMap = new Map((existingAssets ?? []).map((a) => [a.symbol.toUpperCase(), a]));

  // 3. Upsert extracted asset items
  let insertedCount = 0;
  let updatedCount = 0;

  for (const item of extractedAssets) {
    const symbolUpper = item.symbol.toUpperCase();
    const existing = existingMap.get(symbolUpper);

    if (existing) {
      // Update existing asset
      const { error: updateError } = await supabase
        .from('assets')
        .update({
          quantity: item.quantity,
          average_cost: item.averageCost,
          current_price: item.averageCost,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (!updateError) updatedCount++;
    } else {
      // Insert new asset
      const { error: insertError } = await supabase
        .from('assets')
        .insert({
          portfolio_id: finalPortfolioId,
          user_id: user.id,
          symbol: symbolUpper,
          name: item.name,
          asset_type: item.assetType,
          sector: item.sector,
          currency: 'USD',
          quantity: item.quantity,
          average_cost: item.averageCost,
          current_price: item.averageCost,
        });

      if (!insertError) insertedCount++;
    }
  }

  revalidatePath('/dashboard');

  return {
    success: true,
    message: `นำเข้าข้อมูลสำเร็จ: เพิ่มสินทรัพย์ใหม่ ${insertedCount} รายการ, อัปเดต ${updatedCount} รายการ`,
    targetPortfolioId: finalPortfolioId,
  };
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
