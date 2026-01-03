import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DeliveryNote, PurchaseOrder, ProductDefinition } from '../types/pharmacy';

export const generateQuarantineReport = (
    note: DeliveryNote,
    po: PurchaseOrder | undefined,
    products: ProductDefinition[]
) => {
    const doc = new jsPDF();
    const poRef = note.poId;
    const blRef = note.grnReference || note.id;
    const supplierName = po?.supplierName || 'Fournisseur Inconnu';
    const processedBy = note.processingResult?.processedBy || note.createdBy || 'Inconnu';
    const processedDate = note.processingResult?.processedDate 
        ? new Date(note.processingResult.processedDate).toLocaleString('fr-FR')
        : 'N/A';

    // HEADER
    doc.setFontSize(18);
    doc.setTextColor(41, 128, 185);
    doc.text("Rapport de Contrôle Quarantaine", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Réf BL: ${blRef}`, 14, 30);
    doc.text(`Bon de Commande: ${poRef}`, 14, 35);
    doc.text(`Fournisseur: ${supplierName}`, 14, 40);
    
    doc.text(`Traité par: ${processedBy}`, 140, 30);
    doc.text(`Date: ${processedDate}`, 140, 35);

    doc.setDrawColor(200);
    doc.line(14, 45, 196, 45);

    // CONTENT
    let yPos = 55;

    if (!note.processingResult?.items) {
        doc.text("Aucune donnée de traitement disponible.", 14, 60);
        doc.save(`Rapport_Quarantaine_${blRef}.pdf`);
        return;
    }

    note.processingResult.items.forEach((item) => {
        const product = products.find(p => p.id === item.productId);
        const productName = product?.name || item.productId;
        
        const totalInjected = item.batches.reduce((sum, b) => sum + b.quantity, 0);
        const totalReturned = item.returns.reduce((sum, r) => sum + r.quantity, 0);

        // Product Header
        autoTable(doc, {
            startY: yPos,
            head: [[`Produit: ${productName}`, 'Livré', 'Injecté', 'Retourné']],
            body: [[
                '', 
                item.deliveredQty.toString(), 
                totalInjected.toString(), 
                totalReturned.toString()
            ]],
            theme: 'grid',
            headStyles: { fillColor: [44, 62, 80], textColor: 255, fontSize: 11, fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 'auto', fontStyle: 'bold' },
                1: { cellWidth: 30, halign: 'center' },
                2: { cellWidth: 30, halign: 'center', textColor: [39, 174, 96] }, // Green for Injected
                3: { cellWidth: 30, halign: 'center', textColor: [192, 57, 43] } // Red for Returned
            },
            margin: { left: 14, right: 14 }
        });

        // @ts-ignore
        yPos = doc.lastAutoTable.finalY + 5;

        // Batches Table (if any)
        if (item.batches.length > 0) {
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text("Lots Injectés:", 14, yPos);
            yPos += 2;

            const batchRows = item.batches.map(b => [
                b.batchNumber,
                b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : '-',
                b.locationId,
                b.quantity
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [['N° Lot', 'Péremption', 'Emplacement', 'Qté']],
                body: batchRows,
                theme: 'plain',
                headStyles: { fillColor: [240, 240, 240], textColor: 0, fontSize: 8 },
                bodyStyles: { fontSize: 8 },
                columnStyles: {
                    3: { halign: 'right', fontStyle: 'bold', textColor: [39, 174, 96] }
                },
                margin: { left: 20, right: 20 } // Indented
            });

            // @ts-ignore
            yPos = doc.lastAutoTable.finalY + 5;
        }

        // Returns Table (if any)
        if (item.returns.length > 0) {
            doc.setFontSize(9);
            doc.setTextColor(192, 57, 43); // Red Label
            doc.text("Retours / Rejets:", 14, yPos);
            yPos += 2;

            const returnRows = item.returns.map(r => [
                r.reason,
                r.notes || '-',
                r.quantity
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [['Motif', 'Note', 'Qté']],
                body: returnRows,
                theme: 'plain',
                headStyles: { fillColor: [253, 237, 236], textColor: [192, 57, 43], fontSize: 8 },
                bodyStyles: { fontSize: 8, textColor: [192, 57, 43] },
                columnStyles: {
                    2: { halign: 'right', fontStyle: 'bold' }
                },
                margin: { left: 20, right: 20 }
            });

            // @ts-ignore
            yPos = doc.lastAutoTable.finalY + 5;
        }

        yPos += 5; // Spacing between products
    });

    // FOOTER
    const pageCount = (doc.internal as any).getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} / ${pageCount} - Généré automatiquement par PharmaCount`, 105, 290, { align: 'center' });
    }

    doc.save(`Rapport_Quarantaine_${blRef}.pdf`);
};
