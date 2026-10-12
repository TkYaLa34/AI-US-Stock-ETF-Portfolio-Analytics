'use client';

/**
 * Professional Portfolio Document & Image Upload Component with AI OCR Preview.
 *
 * Provides drag-and-drop & file browser upload for PDF, PNG, and JPG portfolio
 * statements and screenshots. Displays clean previews, status indicators
 * (Processing, Success, Error), and extracted OCR analytics.
 *
 * STRICTLY NON-TRANSACTIONAL: Focuses exclusively on analytics and tracking.
 */

import { useState, useEffect, useRef, type DragEvent, type ChangeEvent } from 'react';
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Trash2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';

import {
  uploadPortfolioDocumentAction,
  listUserUploadsAction,
  deleteUploadAction,
  type UploadActionResult,
} from '@/server/actions/upload-actions';
import type { OcrextractedData } from '@/lib/portfolio/ocr';
import type { PortfolioUploadsRow } from '@/types/database.types';

export interface DocumentUploadModalProps {
  portfolioId: string | null;
  onClose: () => void;
  onApplyExtractedData?: (extracted: OcrextractedData) => void;
}

export function DocumentUploadModal({
  portfolioId,
  onClose,
  onApplyExtractedData,
}: DocumentUploadModalProps) {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadActionResult | null>(null);
  const [userUploads, setUserUploads] = useState<PortfolioUploadsRow[]>([]);
  const [isLoadingUploads, setIsLoadingUploads] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    async function loadUploads() {
      setIsLoadingUploads(true);
      const data = await listUserUploadsAction();
      if (active) {
        setUserUploads(data);
        setIsLoadingUploads(false);
      }
    }
    loadUploads();
    return () => {
      active = false;
    };
  }, []);

  const handleFileSelect = (file: File) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setUploadResult({
        success: false,
        message: 'กรุณาเลือกไฟล์ PDF, PNG หรือ JPG เท่านั้น',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadResult({
        success: false,
        message: 'ขนาดไฟล์ต้องไม่เกิน 10MB',
      });
      return;
    }

    setSelectedFile(file);
    setUploadResult(null);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleStartUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (portfolioId) {
      formData.append('portfolioId', portfolioId);
    }

    const result = await uploadPortfolioDocumentAction(formData);
    setIsUploading(false);
    setUploadResult(result);

    if (result.success && result.upload) {
      setUserUploads((prev) => [result.upload!, ...prev]);
    }
  };

  const handleDeleteUpload = async (uploadId: string, filePath: string) => {
    setDeletingId(uploadId);
    const res = await deleteUploadAction(uploadId, filePath);
    setDeletingId(null);
    if (res.success) {
      setUserUploads((prev) => prev.filter((item) => item.id !== uploadId));
      if (uploadResult?.upload?.id === uploadId) {
        setUploadResult(null);
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 my-8 text-slate-100 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-brand-500/20 p-2.5 text-brand-400">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                อัปโหลดเอกสาร / รูปภาพพอร์ตโฟลิโอ (AI OCR Scanner)
              </h2>
              <p className="text-xs text-slate-400">
                สแกนรายงานและภาพหน้าจอด้วยระบบ AI เพื่อติดตามและวิเคราะห์สัดส่วนการลงทุน (Non-Transactional)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Upload Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ${
            isDragging
              ? 'border-brand-500 bg-brand-950/30'
              : selectedFile
                ? 'border-slate-700 bg-slate-950/60'
                : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-950/80'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleInputChange}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center gap-3">
            <div className="rounded-full bg-slate-800/80 p-3 text-slate-300">
              {selectedFile?.type.startsWith('image/') ? (
                <ImageIcon className="h-8 w-8 text-brand-400" />
              ) : selectedFile?.type === 'application/pdf' ? (
                <FileText className="h-8 w-8 text-brand-400" />
              ) : (
                <UploadCloud className="h-8 w-8 text-slate-400" />
              )}
            </div>

            {selectedFile ? (
              <div>
                <p className="font-semibold text-slate-200 text-sm">{selectedFile.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatFileSize(selectedFile.size)} • {selectedFile.type}
                </p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-slate-200 text-sm">
                  ลากไฟล์มาวางที่นี่ หรือ <span className="text-brand-400 underline">คลิกเพื่อเลือกไฟล์</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  รองรับไฟล์ PDF, PNG และ JPG (ขนาดไม่เกิน 10MB)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Selected File Preview & Upload Trigger */}
        {selectedFile ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Document Preview"
                  className="h-16 w-16 object-cover rounded-lg border border-slate-800"
                />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                  <FileSpreadsheet className="h-8 w-8 text-brand-400" />
                </div>
              )}
              <div>
                <p className="font-bold text-sm text-slate-200">{selectedFile.name}</p>
                <p className="text-xs text-slate-400">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                  setUploadResult(null);
                }}
                disabled={isUploading}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={handleStartUpload}
                disabled={isUploading}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    กำลังสแกน AI OCR...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    เริ่มสแกนด้วย AI OCR
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}

        {/* Status Indicator & Extracted Result Preview */}
        {uploadResult ? (
          <div
            className={`rounded-xl border p-4 text-xs space-y-3 ${
              uploadResult.success
                ? 'border-emerald-500/30 bg-emerald-950/20'
                : 'border-red-500/30 bg-red-950/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                {uploadResult.success ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-300">สถานะ: ประมวลผลสำเร็จ (Success)</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-400" />
                    <span className="text-red-300">สถานะ: ไม่สำเร็จ (Error)</span>
                  </>
                )}
              </div>
              <span className="text-slate-400">{uploadResult.message}</span>
            </div>

            {uploadResult.extractedData ? (
              <div className="space-y-3 border-t border-slate-800/80 pt-3">
                <div className="rounded bg-slate-950/80 p-3 border border-slate-800 text-slate-300 leading-relaxed">
                  <p className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                    <Sparkles className="h-3.5 w-3.5 text-brand-400" />
                    สรุปผลการวิเคราะห์ AI:
                  </p>
                  <p className="mt-1 text-slate-300">{uploadResult.extractedData.aiInsights.summary}</p>
                </div>

                {/* Extracted Asset Table */}
                <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">สัญลักษณ์ (Symbol)</th>
                        <th className="p-2.5">ชื่อหลักทรัพย์</th>
                        <th className="p-2.5 text-right">จำนวนหุ้น</th>
                        <th className="p-2.5 text-right">ต้นทุนเฉลี่ย ($)</th>
                        <th className="p-2.5 text-right">น้ำหนัก (% Weight)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-200">
                      {uploadResult.extractedData.extractedAssets.map((asset) => (
                        <tr key={asset.symbol} className="hover:bg-slate-900/50">
                          <td className="p-2.5 font-bold text-brand-300">{asset.symbol}</td>
                          <td className="p-2.5 text-slate-300">{asset.name}</td>
                          <td className="p-2.5 text-right font-medium">{asset.quantity}</td>
                          <td className="p-2.5 text-right font-medium">${asset.averageCost.toFixed(2)}</td>
                          <td className="p-2.5 text-right font-bold text-emerald-400">{asset.weightPercent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {onApplyExtractedData ? (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => onApplyExtractedData(uploadResult.extractedData!)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
                    >
                      นำข้อมูลเข้าสู่แดชบอร์ดเพื่อวิเคราะห์ภาพรวม
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Upload History Section */}
        <div className="border-t border-slate-800 pt-4 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center justify-between">
            <span>ประวัติเอกสารและรูปภาพที่เคยอัปโหลด</span>
            <span className="text-xs font-normal text-slate-400">({userUploads.length} รายการ)</span>
          </h3>

          {isLoadingUploads ? (
            <div className="flex items-center justify-center p-6 text-slate-500 text-xs gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลดรายการเอกสาร...
            </div>
          ) : userUploads.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">ยังไม่มีประวัติการอัปโหลดเอกสาร</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1 no-scrollbar">
              {userUploads.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="rounded p-1.5 bg-slate-900 border border-slate-800 text-brand-400 shrink-0">
                      {item.mime_type.startsWith('image/') ? (
                        <ImageIcon className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </div>
                    <div className="truncate">
                      <p className="font-semibold text-slate-200 truncate">{item.file_name}</p>
                      <p className="text-[11px] text-slate-500">
                        {formatFileSize(item.file_size)} • {new Date(item.created_at).toLocaleDateString('th-TH')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      <ShieldCheck className="h-3 w-3" /> {item.status}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDeleteUpload(item.id, item.file_path)}
                      disabled={deletingId === item.id}
                      className="text-slate-500 hover:text-red-400 transition-colors p-1"
                      title="ลบเอกสาร"
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
