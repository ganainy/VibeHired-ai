// client/src/components/cv-editor/CvPreviewModal.tsx
import React, { useEffect, useRef } from 'react';

interface CvPreviewModalProps {
 isOpen: boolean;
 onClose: () => void;
 pdfBase64: string | null;
 isLoading?: boolean;
}

const CvPreviewModal: React.FC<CvPreviewModalProps> = ({
 isOpen,
 onClose,
 pdfBase64,
 isLoading = false
}) => {
 const blobUrlRef = useRef<string | null>(null);

 useEffect(() => {
 if (isOpen && pdfBase64 && !isLoading) {
 // Convert base64 to blob and create object URL
 const byteCharacters = atob(pdfBase64);
 const byteNumbers = new Array(byteCharacters.length);
 for (let i = 0; i < byteCharacters.length; i++) {
 byteNumbers[i] = byteCharacters.charCodeAt(i);
 }
 const byteArray = new Uint8Array(byteNumbers);
 const blob = new Blob([byteArray], { type: 'application/pdf' });
 const url = URL.createObjectURL(blob);
 blobUrlRef.current = url;

 // Open in new tab with native browser PDF viewer
 window.open(url, '_blank');
 }

 // Cleanup: revoke blob URL when modal closes
 return () => {
 if (blobUrlRef.current) {
 URL.revokeObjectURL(blobUrlRef.current);
 blobUrlRef.current = null;
 }
 };
 }, [isOpen, pdfBase64, isLoading]);

 useEffect(() => {
 if (isOpen && pdfBase64 && !isLoading) {
 // Auto-close the modal since we opened in new tab
 const timer = setTimeout(() => {
 onClose();
 }, 500);
 return () => clearTimeout(timer);
 }
 }, [isOpen, pdfBase64, isLoading, onClose]);

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
 <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md mx-4 sm:mx-0">
 <div className="text-center">
 {isLoading ? (
 <>
 <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
 <p className="text-secondary-color">Opening CV preview...</p>
 </>
 ) : (
 <p className="text-secondary-color">Opening PDF in new tab...</p>
 )}
 </div>
 </div>
 </div>
 );
};

export default CvPreviewModal;

