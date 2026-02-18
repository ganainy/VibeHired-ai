import React from 'react';
import { JsonResumeSchema, JsonResumeCertificateItem } from '../../../../../server/src/types/jsonresume';
import { FormSection, FormItem } from '../Form';
import { Input } from '../Form/InputGroup';

interface CertificatesFormProps {
    data: JsonResumeSchema;
    onChange: (data: JsonResumeSchema) => void;
}

const CertificatesIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
);

const initialCertificateItem: JsonResumeCertificateItem = {
    name: '',
    date: '',
    issuer: '',
    url: '',
};

export const CertificatesForm: React.FC<CertificatesFormProps> = ({
    data,
    onChange,
}) => {
    const certificates = data.certificates || [];

    const handleCertificateChange = (index: number, field: keyof JsonResumeCertificateItem, value: string) => {
        const updatedCertificates = [...certificates];
        updatedCertificates[index] = { ...updatedCertificates[index], [field]: value };
        onChange({ ...data, certificates: updatedCertificates });
    };

    const addCertificate = () => {
        onChange({
            ...data,
            certificates: [...certificates, { ...initialCertificateItem }],
        });
    };

    const deleteCertificate = (index: number) => {
        const updatedCertificates = certificates.filter((_, i) => i !== index);
        onChange({ ...data, certificates: updatedCertificates });
    };

    const moveCertificate = (index: number, direction: 'up' | 'down') => {
        const updatedCertificates = [...certificates];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= updatedCertificates.length) return;

        [updatedCertificates[index], updatedCertificates[newIndex]] = [updatedCertificates[newIndex], updatedCertificates[index]];
        onChange({ ...data, certificates: updatedCertificates });
    };

    return (
        <FormSection
            title="Certifications"
            icon={<CertificatesIcon />}
            onAdd={addCertificate}
            addButtonText="Add Certification"
            isCollapsible
            defaultExpanded={false}
        >
            {certificates.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic py-4">
                    No certifications added yet. Click "Add Certification" to showcase your credentials.
                </p>
            ) : (
                certificates.map((item, index) => (
                    <FormItem
                        key={index}
                        index={index}
                        total={certificates.length}
                        onMoveUp={() => moveCertificate(index, 'up')}
                        onMoveDown={() => moveCertificate(index, 'down')}
                        onDelete={() => deleteCertificate(index)}
                    >
                        {/* Certificate Name */}
                        <Input
                            label="Certification Name"
                            labelClassName="col-span-6"
                            name={`certName-${index}`}
                            placeholder="AWS Solutions Architect"
                            value={item.name || ''}
                            onChange={(v) => handleCertificateChange(index, 'name', v)}
                        />

                        {/* Issuer and Date */}
                        <Input
                            label="Issuing Organization"
                            labelClassName="col-span-4"
                            name={`certIssuer-${index}`}
                            placeholder="Amazon Web Services"
                            value={item.issuer || ''}
                            onChange={(v) => handleCertificateChange(index, 'issuer', v)}
                        />
                        <Input
                            label="Date"
                            labelClassName="col-span-2"
                            name={`certDate-${index}`}
                            placeholder="Dec 2023"
                            value={item.date || ''}
                            onChange={(v) => handleCertificateChange(index, 'date', v)}
                        />

                        {/* URL */}
                        <Input
                            label="Credential URL (optional)"
                            labelClassName="col-span-6"
                            name={`certUrl-${index}`}
                            placeholder="https://verify.credential.com/..."
                            value={item.url || ''}
                            onChange={(v) => handleCertificateChange(index, 'url', v)}
                        />
                    </FormItem>
                ))
            )}
        </FormSection>
    );
};

export default CertificatesForm;
